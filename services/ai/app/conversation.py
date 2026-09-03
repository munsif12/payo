"""One conversational turn, streamed as SSE events per roadmap Contract 2.

Event order: `transcript` (audio turns only) → `token`* → `card`* → `audio` → `done`,
or `error`. Chat history is persisted through the backend /chat API so the app's
transcript survives restarts and the agent sees prior turns.
"""
import json
from typing import Any, AsyncIterator

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from .agent import run_agent
from .backend_client import BackendClient, BackendError
from .config import settings
from .lang import reply_language
from .stt import TranscribeProvider
from .tts import TtsProvider


def sse(event: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


def _card_facts(card: dict[str, Any]) -> str | None:
    """One card rendered as a compact `kind: k=v k=v` fact string for the model.

    The persisted message text stays clean (the app renders cards natively); only the
    model-facing history gets these lines, so a later turn can read back the ids it needs
    (institution_id, identifier, bill_id, action_id) instead of re-asking or re-resolving.
    """
    kind = card.get("kind")
    def kv(pairs: list[tuple[str, Any]]) -> str:
        return " ".join(f"{k}={v}" for k, v in pairs if v not in (None, ""))

    if kind == "recipient":
        inst = card.get("institution") or {}
        return "recipient: " + kv([
            ("institution_id", inst.get("id")),
            ("institution", inst.get("name")),
            ("identifier", card.get("identifier")),
            ("title", card.get("title")),
            ("linked_user_id", card.get("linkedUserId")),
        ])
    if kind == "institution_chips":
        items = card.get("institutions") or []
        return "institution_chips: " + ", ".join(
            f"{i.get('institutionId')}:{i.get('name')}" for i in items
        )
    if kind == "recipient_chips":
        items = card.get("recipients") or []
        return "recipient_chips: " + ", ".join(
            f"{r.get('recipientId')}:{r.get('nickname')}" for r in items
        )
    if kind == "biller_chips":
        items = card.get("billers") or []
        return "biller_chips: " + ", ".join(
            f"{b.get('billerId')}:{b.get('name')}"
            + (f"/{b.get('consumerNo')}" if b.get("consumerNo") else "")
            for b in items
        )
    if kind == "bill":
        return "bill: " + kv([
            ("bill_id", card.get("billId")),
            ("biller", card.get("biller")),
            ("consumer_no", card.get("consumerNo") or card.get("consumerName")),
            ("amount_paisa", card.get("amountPaisa")),
            ("due", (card.get("dueDate") or "")[:10] or None),
        ])
    if kind == "confirmation":
        return "confirmation: " + kv([
            ("action_id", card.get("actionId")),
            ("amount_paisa", card.get("amountPaisa")),
        ])
    if kind == "pocket":
        return "pocket: " + kv([("pocket_id", card.get("pocketId")), ("name", card.get("name"))])
    if kind == "balance":
        return "balance: " + kv([("balance_paisa", card.get("balancePaisa"))])
    return None


def cards_context_line(cards: list[dict[str, Any]] | None) -> str:
    """`[cards] ...` line appended to an assistant message in the model-facing history."""
    facts = [f for f in (_card_facts(c) for c in cards or []) if f]
    return "[cards] " + " | ".join(facts) if facts else ""


def _history_from_messages(items: list[dict[str, Any]]) -> list[BaseMessage]:
    history: list[BaseMessage] = []
    for m in items[-12:]:  # last few turns are enough context
        if m["role"] == "user":
            history.append(HumanMessage(content=m["text"]))
        else:
            line = cards_context_line(m.get("cards"))
            text = f"{m['text']}\n{line}" if line else m["text"]
            history.append(AIMessage(content=text))
    return history


def _resolved_pairs_from_messages(items: list[dict[str, Any]]) -> set[tuple[str, str]]:
    """(institution_id, identifier) pairs the user already saw resolved via a `recipient`
    card earlier in this conversation — full history, not just the trimmed window kept
    for the model's text context, since the recipient card itself may have scrolled out
    of that window by the time the user confirms."""
    pairs: set[tuple[str, str]] = set()
    for m in items:
        for card in m.get("cards") or []:
            if card.get("kind") == "recipient":
                institution_id = (card.get("institution") or {}).get("id")
                identifier = card.get("identifier")
                if institution_id and identifier:
                    pairs.add((institution_id, identifier.strip().lower()))
    return pairs


async def converse_turn(
    client: BackendClient,
    *,
    text: str | None,
    audio: bytes | None,
    audio_mime: str | None,
    session_id: str | None,
    language: str,
    tts: TtsProvider,
    transcriber: TranscribeProvider,
    model: BaseChatModel | None = None,
) -> AsyncIterator[dict[str, str]]:
    try:
        if model is None and not settings.gemini_api_key:
            yield sse("error", {"code": "NO_GEMINI_KEY",
                                "message": "GEMINI_API_KEY is not configured on the AI service"})
            return
        if audio is not None:
            text = await transcriber.transcribe(audio, audio_mime or "audio/m4a", language)
            yield sse("transcript", {"text": text})
        if not text or not text.strip():
            yield sse("error", {"code": "EMPTY_INPUT", "message": "No text or audio provided"})
            return

        if session_id:
            existing = await client.messages(session_id)
            history = _history_from_messages(existing["items"])
            resolved_pairs = _resolved_pairs_from_messages(existing["items"])
        else:
            session = await client.create_session()
            session_id = session["id"]
            history = []
            resolved_pairs = set()

        await client.add_message(session_id, "user", text)

        # The reply language follows the input's own script when it's Urdu, even if the
        # UI language is English — e.g. a Roman-Urdu UI user who types/speaks Urdu script.
        turn_language = reply_language(text, language)
        reply, cards = await run_agent(
            client, history, text, turn_language, model=model, resolved_pairs=resolved_pairs
        )

        for token in reply.split(" "):
            yield sse("token", {"text": token + " "})
        for card in cards:
            yield sse("card", {"card": card})

        audio_id = await tts.synthesize(reply, language)
        yield sse("audio", {"url": f"/tts/{audio_id}"})

        message = await client.add_message(session_id, "assistant", reply, cards or None)
        yield sse("done", {"sessionId": session_id, "messageId": message["id"]})
    except BackendError as e:
        yield sse("error", {"code": e.code, "message": e.message})
    except Exception as e:  # keep the stream well-formed on unexpected failures
        yield sse("error", {"code": "INTERNAL", "message": str(e)})

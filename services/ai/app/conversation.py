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
from .stt import NO_SPEECH, TranscribeProvider
from .tts import TtsProvider


# What the assistant says when the clip carried no speech. Never reaches the model.
NO_SPEECH_REPLY = {
    "en": "I didn't catch that — please say it again.",
    "ur": "معاف کیجیے، سنائی نہیں دیا، دوبارہ کہیں۔",
}
# Belt and braces: older prompts (or a stubborn model) narrate the audio instead of
# answering NO_SPEECH — "There is no speech in the audio. The audio contains…".
_NO_SPEECH_PREFIXES = ("there is no speech", "there's no speech", "no speech",
                       "کوئی آواز نہیں", "کوئی بات نہیں سنائی")


def is_no_speech(transcript: str | None) -> bool:
    """True when the clip carried nothing to answer: empty, NO_SPEECH, or a narration of
    the sounds in it. Such a turn must never reach the model or the chat history."""
    text = (transcript or "").strip()
    if not text:
        return True
    if text.upper().strip(".!") == NO_SPEECH:
        return True
    return text.lower().startswith(_NO_SPEECH_PREFIXES)


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
        # institution_id+identifier ride along so a later turn that picks one specific
        # option (e.g. "the JazzCash one") can resolve it directly — several chips can
        # share the same nickname (that's exactly why they needed disambiguating), so
        # recipient_id/nickname alone is not enough to tell them apart.
        return "recipient_chips: " + ", ".join(
            f"{r.get('recipientId')}:{r.get('nickname')}@{r.get('institutionName')}"
            f"(institution_id={r.get('institutionId')} identifier={r.get('identifier')})"
            for r in items
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
    if kind == "receipt":
        txn = card.get("txn") or {}
        return "receipt: " + kv([
            ("txn_id", txn.get("id")),
            ("amount_paisa", txn.get("amountPaisa")),
            ("direction", txn.get("direction")),
            ("counterparty", (txn.get("counterparty") or {}).get("name")),
            ("category", txn.get("category")),
            ("ref_no", txn.get("refNo")),
            ("date", (txn.get("createdAt") or "")[:10] or None),
        ])
    if kind == "transactions":
        items = card.get("items") or []
        return "transactions: " + ", ".join(
            f"{t.get('id')}:{t.get('counterparty', {}).get('name')}"
            f"({'+' if t.get('direction') == 'in' else '-'}{t.get('amountPaisa')})"
            for t in items
        )
    if kind == "spending":
        return "spending: " + kv([
            ("period", (card.get("period") or {}).get("en")),
            ("total_out_paisa", card.get("totalOutPaisa")),
            ("total_in_paisa", card.get("totalInPaisa")),
        ])
    if kind == "account":
        return "account: " + kv([
            ("name", card.get("name")), ("phone", card.get("phone")),
            ("balance_paisa", card.get("balancePaisa")), ("language", card.get("language")),
        ])
    if kind == "profile":
        return "profile: " + kv([
            ("name", card.get("name")), ("language", card.get("language")),
            ("applied", ",".join(card.get("applied") or []) or None),
        ])
    if kind == "help":
        return "help: shown"
    if kind == "card":
        # last4 only — pan/cvv never exist on this card, so they can never reach history.
        return "card: " + kv([("last4", card.get("last4")), ("frozen", card.get("frozen"))])
    if kind == "statements":
        items = card.get("items") or []
        return "statements: " + ", ".join(
            f"{i.get('statementId')}:{(i.get('period') or {}).get('en')}" for i in items
        )
    if kind == "recipients":
        items = card.get("items") or []
        return "recipients: " + ", ".join(
            f"{r.get('recipientId')}:{r.get('nickname')}@{r.get('institutionName')}"
            f"(institution_id={r.get('institutionId')} identifier={r.get('identifier')})"
            for r in items
        )
    if kind == "bills":
        items = card.get("items") or []
        return "bills: " + ", ".join(
            f"{b.get('billId')}:{b.get('biller')}({b.get('amountPaisa')})" for b in items
        )
    if kind == "billers":
        items = card.get("items") or []
        return "billers: " + ", ".join(
            f"{b.get('savedBillerId')}:{b.get('name')}"
            + (f"/{b.get('consumerNo')}" if b.get("consumerNo") else "")
            + f"(biller_id={b.get('billerId')})"
            for b in items
        )
    if kind == "telco_chips":
        items = card.get("telcos") or []
        return "telco_chips: " + ", ".join(f"{t.get('telcoId')}:{t.get('name')}" for t in items)
    if kind == "pockets":
        items = card.get("items") or []
        return "pockets: " + ", ".join(
            f"{p.get('pocketId')}:{p.get('name')}({p.get('balancePaisa')})" for p in items
        )
    if kind == "request":
        return "request: " + kv([
            ("request_id", card.get("requestId")), ("direction", card.get("direction")),
            ("amount_paisa", card.get("amountPaisa")),
            ("counterparty", (card.get("counterparty") or {}).get("name")),
            ("status", card.get("status")),
        ])
    if kind == "requests":
        items = card.get("items") or []
        return "requests: " + ", ".join(
            f"{r.get('requestId')}:{r.get('direction')}/{r.get('status')}/"
            f"{(r.get('counterparty') or {}).get('name')}({r.get('amountPaisa')})"
            for r in items
        )
    if kind == "qr":
        return "qr: " + kv([("name", card.get("name")), ("phone", card.get("phone"))])
    if kind == "pocket":
        return "pocket: " + kv([("pocket_id", card.get("pocketId")), ("name", card.get("name"))])
    if kind == "balance":
        return "balance: " + kv([("balance_paisa", card.get("balancePaisa"))])
    return None


def cards_context_line(cards: list[dict[str, Any]] | None) -> str:
    """`[cards] ...` line appended to an assistant message in the model-facing history."""
    facts = [f for f in (_card_facts(c) for c in cards or []) if f]
    return "[cards] " + " | ".join(facts) if facts else ""


# Model-facing history window (spec §4.4). Older turns are dropped entirely — the generic
# "I can help you with your banking needs" non-answer only ever appeared in long, mixed-
# language sessions. A "turn" here is one persisted message (user or assistant); the
# `[cards]` line of every RETAINED assistant turn is kept, so ids stay actionable.
HISTORY_WINDOW_TURNS = 12


def _history_from_messages(items: list[dict[str, Any]]) -> list[BaseMessage]:
    history: list[BaseMessage] = []
    for m in items[-HISTORY_WINDOW_TURNS:]:
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
            if is_no_speech(text):
                # Nothing was said: don't run the agent, don't persist a user message, and
                # never let a narration of the noise ("...a ball bouncing") become a turn.
                reply = NO_SPEECH_REPLY.get(language, NO_SPEECH_REPLY["en"])
                yield sse("transcript", {"text": ""})
                yield sse("token", {"text": reply})
                audio_id = await tts.synthesize(reply, language)
                yield sse("audio", {"url": f"/tts/{audio_id}"})
                yield sse("done", {"sessionId": session_id})
                return
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

        # The reply is in `turn_language` (Urdu-script input overrides an English UI), so the
        # voice and the Urdu number-words pass must follow it too — not the UI language.
        audio_id = await tts.synthesize(reply, turn_language)
        yield sse("audio", {"url": f"/tts/{audio_id}"})

        message = await client.add_message(session_id, "assistant", reply, cards or None)
        yield sse("done", {"sessionId": session_id, "messageId": message["id"]})
    except BackendError as e:
        yield sse("error", {"code": e.code, "message": e.message})
    except Exception as e:  # keep the stream well-formed on unexpected failures
        yield sse("error", {"code": "INTERNAL", "message": str(e)})

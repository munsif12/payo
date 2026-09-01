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
from .stt import TranscribeProvider
from .tts import TtsProvider


def sse(event: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


def _history_from_messages(items: list[dict[str, Any]]) -> list[BaseMessage]:
    history: list[BaseMessage] = []
    for m in items[-12:]:  # last few turns are enough context
        if m["role"] == "user":
            history.append(HumanMessage(content=m["text"]))
        else:
            history.append(AIMessage(content=m["text"]))
    return history


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
        if audio is not None:
            if not settings.gemini_api_key:
                yield sse("error", {"code": "NO_GEMINI_KEY",
                                    "message": "GEMINI_API_KEY is not configured on the AI service"})
                return
            text = await transcriber.transcribe(audio, audio_mime or "audio/m4a", language)
            yield sse("transcript", {"text": text})
        if not text or not text.strip():
            yield sse("error", {"code": "EMPTY_INPUT", "message": "No text or audio provided"})
            return

        if session_id:
            existing = await client.messages(session_id)
            history = _history_from_messages(existing["items"])
        else:
            session = await client.create_session()
            session_id = session["id"]
            history = []

        await client.add_message(session_id, "user", text)

        if model is None and not settings.gemini_api_key:
            yield sse("error", {"code": "NO_GEMINI_KEY",
                                "message": "GEMINI_API_KEY is not configured on the AI service"})
            return

        reply, cards = await run_agent(client, history, text, language, model=model)

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

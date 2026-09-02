"""Text-to-speech provider layer.

CartesiaTts (Sonic 3.6 — the first Sonic generation with Urdu) is used when
CARTESIA_API_KEY is set; otherwise StubTts returns a short silent MP3 so the demo
degrades gracefully (text + cards still work). Synthesized audio is kept in an
in-memory store served by GET /tts/{id}.

Credit-safety rules for the paid provider (the demo account has a tiny balance):
- text is capped at `settings.tts_max_chars` (cut at a sentence boundary) — Cartesia
  bills per character, and a reply's first sentences carry the meaning;
- every request is made exactly once (no SDK retries) — a failed call must never
  be re-billed;
- any provider failure (out of credits, network, bad voice) falls back to the silent
  stub so the SSE stream stays well-formed and the visual demo continues.
"""
import logging
import re
import uuid
from typing import Protocol

from .config import settings

log = logging.getLogger(__name__)

AUDIO_STORE: dict[str, bytes] = {}

# A minimal valid silent MP3 frame sequence (MPEG-1 Layer III, ~0.1s of silence).
SILENT_MP3 = bytes.fromhex("fffb9064") + bytes(414)

CARTESIA_MODEL_ID = "sonic-3.6"
_SENTENCE_END = re.compile(r"[.!?।۔]\s")


class TtsProvider(Protocol):
    @property
    def is_stub(self) -> bool: ...

    async def synthesize(self, text: str, language: str) -> str:
        """Synthesize text; store the bytes; return the audio id."""


def _store(data: bytes) -> str:
    audio_id = uuid.uuid4().hex
    AUDIO_STORE[audio_id] = data
    # Keep the store bounded for long demo sessions.
    if len(AUDIO_STORE) > 200:
        for key in list(AUDIO_STORE)[:100]:
            AUDIO_STORE.pop(key, None)
    return audio_id


def trim_for_tts(text: str, max_chars: int) -> str:
    """Collapse whitespace and cap length, preferring a sentence boundary."""
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return text
    head = text[:max_chars]
    ends = [m.end() for m in _SENTENCE_END.finditer(head)]
    return head[: ends[-1]].strip() if ends else head.strip()


def voice_for(language: str) -> str:
    return settings.cartesia_voice_ur if language == "ur" else settings.cartesia_voice_en


class StubTts:
    is_stub = True

    async def synthesize(self, text: str, language: str) -> str:
        return _store(SILENT_MP3)


class CartesiaTts:
    is_stub = False

    async def synthesize(self, text: str, language: str) -> str:
        speech = trim_for_tts(text, settings.tts_max_chars)
        if not speech:
            return _store(SILENT_MP3)
        try:
            return _store(await self._request(speech, language))
        except Exception as e:  # never break the stream, never re-bill
            log.warning("cartesia tts failed (%s: %s) — falling back to silent stub", type(e).__name__, e)
            return _store(SILENT_MP3)

    async def _request(self, speech: str, language: str) -> bytes:
        from cartesia import AsyncCartesia

        client = AsyncCartesia(api_key=settings.cartesia_api_key, max_retries=0)  # never re-bill a failed call
        try:
            stream = await client.tts.bytes(
                model_id=CARTESIA_MODEL_ID,
                transcript=speech,
                voice={"mode": "id", "id": voice_for(language)},
                language=language,
                output_format={"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
            )
            chunks = [chunk async for chunk in stream]
            return b"".join(chunks)
        finally:
            await client.close()


def build_tts() -> TtsProvider:
    if settings.cartesia_api_key:
        return CartesiaTts()
    return StubTts()

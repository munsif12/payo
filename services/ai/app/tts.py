"""Text-to-speech provider layer.

CartesiaTts (Sonic, Urdu-capable) is used when CARTESIA_API_KEY is set; otherwise
StubTts returns a short silent MP3 so the demo degrades gracefully (text + cards
still work). Synthesized audio is kept in an in-memory store served by GET /tts/{id}.
"""
import uuid
from typing import Protocol

from .config import settings

AUDIO_STORE: dict[str, bytes] = {}

# A minimal valid silent MP3 frame sequence (MPEG-1 Layer III, ~0.1s of silence).
SILENT_MP3 = bytes.fromhex("fffb9064") + bytes(414)


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


class StubTts:
    is_stub = True

    async def synthesize(self, text: str, language: str) -> str:
        return _store(SILENT_MP3)


class CartesiaTts:
    is_stub = False

    async def synthesize(self, text: str, language: str) -> str:
        from cartesia import AsyncCartesia

        client = AsyncCartesia(api_key=settings.cartesia_api_key)
        try:
            chunks = []
            async for chunk in client.tts.bytes(
                model_id="sonic-2",
                transcript=text,
                voice={"mode": "id", "id": settings.cartesia_voice_id} if settings.cartesia_voice_id else None,
                language=language,
                output_format={"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
            ):
                chunks.append(chunk)
            return _store(b"".join(chunks))
        finally:
            await client.close()


def build_tts() -> TtsProvider:
    if settings.cartesia_api_key:
        return CartesiaTts()
    return StubTts()

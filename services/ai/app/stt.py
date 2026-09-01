"""Audio-input stage (behind an interface so ElevenLabs Scribe could swap in).

GeminiAudio sends the recorded clip to Gemini with a transcription prompt —
Gemini's native audio understanding handles Urdu and Urdu/English code-mixing
without a lossy STT hop.
"""
from typing import Protocol

from .config import settings


class TranscribeProvider(Protocol):
    async def transcribe(self, audio: bytes, mime_type: str, language: str) -> str: ...


class GeminiAudio:
    async def transcribe(self, audio: bytes, mime_type: str, language: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        lang_name = "Urdu" if language == "ur" else "English"
        res = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Part.from_bytes(data=audio, mime_type=mime_type),
                f"Transcribe this voice note exactly as spoken (it is in {lang_name}, possibly "
                "code-mixed with English). Reply with ONLY the transcript text.",
            ],
        )
        return (res.text or "").strip()


def build_transcriber() -> TranscribeProvider:
    return GeminiAudio()

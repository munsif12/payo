"""Audio-input stage (behind an interface so ElevenLabs Scribe could swap in).

GeminiAudio sends the recorded clip to Gemini with a transcription prompt —
Gemini's native audio understanding handles Urdu and Urdu/English code-mixing
without a lossy STT hop.
"""
import logging
from typing import Protocol

from .config import settings
from .lang import has_devanagari_script

logger = logging.getLogger(__name__)

TRANSCRIBE_PROMPT = (
    "The speech is in Urdu and/or English. Transcribe exactly as spoken. If it is Urdu, "
    "write it in Urdu (Perso-Arabic/Nastaliq) script — NEVER in Hindi/Devanagari script. "
    "If English, write English. Reply with ONLY the transcript."
)

REDO_IN_URDU_SCRIPT_PROMPT = (
    "That transcript used Devanagari script, which is forbidden. Convert it to Urdu "
    "(Perso-Arabic/Nastaliq) script instead — never Devanagari. Reply with ONLY the "
    "corrected transcript."
)


class TranscribeProvider(Protocol):
    async def transcribe(self, audio: bytes, mime_type: str, language: str) -> str: ...


class GeminiAudio:
    async def transcribe(self, audio: bytes, mime_type: str, language: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        audio_part = types.Part.from_bytes(data=audio, mime_type=mime_type)
        res = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=[audio_part, TRANSCRIBE_PROMPT],
        )
        text = (res.text or "").strip()

        if has_devanagari_script(text):
            logger.warning("STT transcript contained Devanagari script; re-asking Gemini for Urdu script")
            res = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=[audio_part, TRANSCRIBE_PROMPT, text, REDO_IN_URDU_SCRIPT_PROMPT],
            )
            text = (res.text or "").strip()

        return text


def build_transcriber() -> TranscribeProvider:
    return GeminiAudio()

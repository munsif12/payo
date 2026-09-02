"""Credit-safety behaviour of the paid provider (no network: the request is stubbed)."""
import pytest

from app import tts as tts_mod
from app.tts import AUDIO_STORE, CARTESIA_MODEL_ID, SILENT_MP3, CartesiaTts, trim_for_tts, voice_for


def test_model_is_urdu_capable_sonic_36():
    assert CARTESIA_MODEL_ID == "sonic-3.6"


def test_trim_prefers_sentence_boundary_and_caps_length():
    text = "پہلا جملہ۔ دوسرا جملہ۔ " + "لمبا " * 200
    out = trim_for_tts(text, 40)
    assert out == "پہلا جملہ۔ دوسرا جملہ۔"
    assert len(trim_for_tts("x" * 1000, 400)) == 400
    assert trim_for_tts("  short   text ", 400) == "short text"


def test_voice_selected_per_language():
    assert voice_for("ur") != voice_for("en")


@pytest.mark.asyncio
async def test_request_receives_trimmed_text_and_urdu_voice(monkeypatch):
    seen = {}

    async def fake_request(self, speech, language):
        seen["speech"], seen["language"] = speech, language
        return b"MP3DATA"

    monkeypatch.setattr(CartesiaTts, "_request", fake_request)
    monkeypatch.setattr(tts_mod.settings, "tts_max_chars", 20)
    audio_id = await CartesiaTts().synthesize("یہ ایک جملہ ہے۔ " + "اضافی " * 50, "ur")
    assert seen["speech"] == "یہ ایک جملہ ہے۔"
    assert seen["language"] == "ur"
    assert AUDIO_STORE[audio_id] == b"MP3DATA"


@pytest.mark.asyncio
async def test_provider_failure_falls_back_to_silence_without_raising(monkeypatch):
    async def boom(self, speech, language):
        raise RuntimeError("402 payment required")

    monkeypatch.setattr(CartesiaTts, "_request", boom)
    audio_id = await CartesiaTts().synthesize("سلام", "ur")
    assert AUDIO_STORE[audio_id] == SILENT_MP3


@pytest.mark.asyncio
async def test_empty_text_never_hits_provider(monkeypatch):
    async def boom(self, speech, language):
        raise AssertionError("must not be called")

    monkeypatch.setattr(CartesiaTts, "_request", boom)
    audio_id = await CartesiaTts().synthesize("   ", "en")
    assert AUDIO_STORE[audio_id] == SILENT_MP3

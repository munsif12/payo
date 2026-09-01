import pytest

from app.tts import AUDIO_STORE, StubTts, build_tts
from app.config import settings

pytestmark = pytest.mark.asyncio


async def test_stub_tts_stores_retrievable_audio():
    audio_id = await StubTts().synthesize("سلام", "ur")
    assert AUDIO_STORE[audio_id][:2] == b"\xff\xfb"  # mp3 frame sync


async def test_provider_selection_by_env(monkeypatch):
    monkeypatch.setattr(settings, "cartesia_api_key", "")
    assert build_tts().is_stub is True
    monkeypatch.setattr(settings, "cartesia_api_key", "key")
    assert build_tts().is_stub is False

# -*- coding: utf-8 -*-
"""POST /speak (spec §4): audio for one already-rendered sentence — TTS only.

Home's proactive digest is spoken without a conversational turn, so this endpoint runs no
model and touches no backend. Every test here uses the silent stub; Cartesia is never called.
"""
from fastapi.testclient import TestClient

from app.main import SPEAK_MAX_CHARS, app
from app.tts import AUDIO_STORE, StubTts

AUTH = {"Authorization": "Bearer jwt"}


class RecordingStub(StubTts):
    """The stub, plus what it was asked to say — the trim is what needs proving."""

    def __init__(self):
        self.spoken: list[tuple[str, str]] = []

    async def synthesize(self, text: str, language: str) -> str:
        self.spoken.append((text, language))
        return await super().synthesize(text, language)


def test_speak_returns_a_playable_url():
    with TestClient(app) as client:
        client.app.state.tts = StubTts()
        res = client.post("/speak", headers=AUTH,
                          json={"text": "آپ کو پانچ ہزار روپے موصول ہوئے۔", "language": "ur"})
        assert res.status_code == 200
        url = res.json()["url"]
        assert url.startswith("/tts/")
        audio = client.get(url)
        assert audio.status_code == 200
        assert audio.content[:2] == b"\xff\xfb"  # mp3 frame sync
        assert AUDIO_STORE[url.removeprefix("/tts/")] == audio.content


def test_speak_trims_to_200_chars_at_a_sentence_boundary():
    stub = RecordingStub()
    long_text = ("Your electricity bill is due. " * 20).strip()
    with TestClient(app) as client:
        client.app.state.tts = stub
        assert client.post("/speak", headers=AUTH,
                           json={"text": long_text, "language": "en"}).status_code == 200
    spoken, language = stub.spoken[-1]
    assert language == "en"
    assert len(spoken) <= SPEAK_MAX_CHARS == 200
    assert spoken.endswith("due.")  # cut at a sentence end, not mid-word


def test_speak_rejects_empty_text_and_defaults_an_unknown_language():
    stub = RecordingStub()
    with TestClient(app) as client:
        client.app.state.tts = stub
        assert client.post("/speak", headers=AUTH, json={"text": "   "}).status_code == 400
        assert client.post("/speak", headers=AUTH,
                           json={"text": "hello", "language": "fr"}).status_code == 200
    assert stub.spoken[-1][1] == "ur"


def test_speak_requires_the_session_bearer():
    """It spends Cartesia credit, so it is gated exactly like /converse — the token is only
    checked here, never forwarded (this endpoint calls no backend)."""
    stub = RecordingStub()
    with TestClient(app) as client:
        client.app.state.tts = stub
        assert client.post("/speak", json={"text": "hello"}).status_code == 401
        assert client.post("/speak", headers={"Authorization": "jwt"},
                           json={"text": "hello"}).status_code == 401
    assert stub.spoken == []  # nothing was synthesized for an unauthenticated caller


def test_speak_never_calls_a_paid_provider_when_tts_is_disabled(monkeypatch):
    """The endpoint uses whatever provider startup built — with no key that is the stub."""
    from app.config import settings
    from app.tts import build_tts

    monkeypatch.setattr(settings, "cartesia_api_key", "")
    assert build_tts().is_stub is True

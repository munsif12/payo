from fastapi.testclient import TestClient

from app.main import app
from app.tts import AUDIO_STORE


def _client_with_audio():
    AUDIO_STORE["abc"] = bytes(range(100))
    return TestClient(app)


def test_tts_serves_byte_ranges_for_avplayer():
    c = _client_with_audio()
    r = c.get("/tts/abc", headers={"Range": "bytes=0-1"})
    assert r.status_code == 206
    assert r.headers["content-range"] == "bytes 0-1/100"
    assert r.headers["accept-ranges"] == "bytes"
    assert r.content == bytes([0, 1])
    r = c.get("/tts/abc", headers={"Range": "bytes=90-"})
    assert r.status_code == 206 and r.content == bytes(range(90, 100))
    r = c.get("/tts/abc", headers={"Range": "bytes=500-600"})
    assert r.status_code == 416


def test_tts_full_and_head():
    c = _client_with_audio()
    r = c.get("/tts/abc")
    assert r.status_code == 200 and len(r.content) == 100 and r.headers["accept-ranges"] == "bytes"
    r = c.head("/tts/abc")
    assert r.status_code == 200 and r.headers["content-length"] == "100" and r.content == b""
    assert c.get("/tts/missing").status_code == 404

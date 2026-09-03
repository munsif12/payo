"""SSE loop tests over the full app with a scripted model and fake backend."""
import json

import httpx
import pytest
from langchain_core.messages import AIMessage

from app import backend_client as bc_module
from app.main import app
from app.tts import StubTts
from tests.test_agent import scripted
from tests.conftest import body_of


class FakeTranscriber:
    async def transcribe(self, audio, mime_type, language):
        return "بلال کو 1500 بھیجو"


@pytest.fixture
def wired_app(fake_backend, monkeypatch):
    # Route BackendClient instances created by the app through the fake backend.
    orig_init = bc_module.BackendClient.__init__

    def patched_init(self, jwt, transport=None):
        orig_init(self, jwt, transport=fake_backend.transport)

    monkeypatch.setattr(bc_module.BackendClient, "__init__", patched_init)
    app.state.tts = StubTts()
    app.state.transcriber = FakeTranscriber()
    return app


def sse_events(text: str):
    events = []
    current = {}
    for line in text.splitlines():
        if line.startswith("event:"):
            current["event"] = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            current["data"] = json.loads(line.split(":", 1)[1].strip())
        elif not line.strip() and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


BALANCE_ROUTES = {
    ("POST", "/api/v1/chat/sessions"): {"id": "sess1", "title": None, "createdAt": "2026-09-02T00:00:00Z"},
    ("GET", "/api/v1/me"): {"user": {}, "account": {"balancePaisa": 8_450_000}, "card": {}},
}


def wire_routes(fake_backend, extra=None):
    for (m, p), data in {**BALANCE_ROUTES, **(extra or {})}.items():
        fake_backend.route(m, p, data)
    msgs = []

    def add_message(req):
        body = body_of(req)
        msgs.append(body)
        return httpx.Response(201, json={"success": True, "data": {"id": f"m{len(msgs)}", **body, "createdAt": "2026-09-02T00:00:00Z"}})

    fake_backend.route("POST", "/api/v1/chat/sessions/sess1/messages", responder=add_message)
    return msgs


async def test_text_turn_streams_tokens_card_audio_done_in_order(fake_backend, wired_app):
    msgs = wire_routes(fake_backend)
    wired_app.state.model_override = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="آپ کا بیلنس ₨84,500 ہے۔"),
    ])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "بیلنس؟", "language": "ur"},
                                headers={"Authorization": "Bearer jwt1"})
    events = sse_events(res.text)
    kinds = [e["event"] for e in events]
    assert kinds[0] == "token"
    assert "card" in kinds and "audio" in kinds and kinds[-1] == "done"
    assert kinds.index("card") > max(i for i, k in enumerate(kinds) if k == "token")
    assert kinds.index("audio") > kinds.index("card")
    card_event = next(e for e in events if e["event"] == "card")
    assert card_event["data"]["card"] == {"kind": "balance", "balancePaisa": 8_450_000}
    done = events[-1]["data"]
    assert done["sessionId"] == "sess1"
    # persisted: user turn then assistant turn with the card
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["cards"][0]["kind"] == "balance"


async def test_audio_turn_emits_transcript_first(fake_backend, wired_app, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "gemini_api_key", "fake-key-for-test")
    pending = {
        "id": "actA", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    wire_routes(fake_backend, {
        ("GET", "/api/v1/recipients"): {"items": [
            {"id": "c3", "nickname": "Bilal", "title": "Bilal Ahmed",
             "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
             "identifier": "+923001110002"},
        ]},
        ("POST", "/api/v1/transfers"): pending,
    })
    wired_app.state.model_override = scripted([
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {"amount_paisa": 150000, "recipient_id": "c3"}, "id": "t1"}]),
        AIMessage(content="تصدیق کے لیے کارڈ دیکھیں۔"),
    ])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse",
                                files={"audio": ("clip.m4a", b"fake-audio-bytes", "audio/m4a")},
                                data={"language": "ur"},
                                headers={"Authorization": "Bearer jwt1"})
    events = sse_events(res.text)
    assert events[0]["event"] == "transcript"
    assert events[0]["data"]["text"] == "بلال کو 1500 بھیجو"
    card = next(e for e in events if e["event"] == "card")
    assert card["data"]["card"]["kind"] == "confirmation"
    assert card["data"]["card"]["actionId"] == "actA"


async def test_tts_endpoint_serves_bytes(fake_backend, wired_app):
    wire_routes(fake_backend)
    wired_app.state.model_override = scripted([AIMessage(content="سلام")])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "سلام"}, headers={"Authorization": "Bearer jwt1"})
        audio_event = next(e for e in sse_events(res.text) if e["event"] == "audio")
        audio_res = await client.get(audio_event["data"]["url"])
    assert audio_res.status_code == 200
    assert audio_res.headers["content-type"] == "audio/mpeg"
    assert audio_res.content[:2] == b"\xff\xfb"


async def test_backend_auth_failure_emits_error_event(fake_backend, wired_app):
    from tests.conftest import err
    fake_backend.route("POST", "/api/v1/chat/sessions", responder=lambda req: err(401, "UNAUTHORIZED", "Invalid token"))
    wired_app.state.model_override = scripted([AIMessage(content="x")])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "بیلنس؟"}, headers={"Authorization": "Bearer bad"})
    events = sse_events(res.text)
    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "UNAUTHORIZED"


async def test_missing_auth_header_is_401(wired_app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "x"})
    assert res.status_code == 401


async def test_urdu_script_text_input_with_english_ui_language_uses_urdu_system_prompt(fake_backend, wired_app):
    """Urdu-script input with ui language 'en' must still get the Urdu system prompt —
    reply_language() overrides the UI language whenever the input itself is Arabic-script."""
    from langchain_core.messages import SystemMessage
    from tests.test_agent import RecordingFakeToolModel

    wire_routes(fake_backend)
    model = RecordingFakeToolModel(messages=iter([AIMessage(content="آپ کا بیلنس ₨84,500 ہے۔")]))
    wired_app.state.model_override = model
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "میرا بیلنس کیا ہے؟", "language": "en"},
                                headers={"Authorization": "Bearer jwt1"})
    assert res.status_code == 200
    assert model.received, "model was never invoked"
    system_msgs = [m for m in model.received[0] if isinstance(m, SystemMessage)]
    assert len(system_msgs) == 1
    assert "ہمیشہ اردو میں ہی دیں" in system_msgs[0].content
    assert "ALWAYS reply in English" not in system_msgs[0].content

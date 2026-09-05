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


def test_resolved_pairs_from_messages_extracts_recipient_cards_across_full_history():
    """Regression for the cross-turn send_money guard: a `recipient` card confirmed several
    turns ago (older than the 12-message window kept for the model's text context) must
    still be picked up, since the user may confirm well after it scrolled out of view."""
    from app.conversation import _resolved_pairs_from_messages

    items = [
        {"role": "user", "text": "pay 100 rupees to 03135468810", "cards": []},
        {
            "role": "assistant",
            "text": "You want to send 100 rupees to Sara Khan at Easypaisa.",
            "cards": [
                {
                    "kind": "recipient",
                    "title": "Sara Khan",
                    "institution": {"id": "easypaisa", "name": "Easypaisa"},
                    "identifier": "+923135468810",
                },
            ],
        },
        {"role": "user", "text": "Yes, continue", "cards": []},
    ]
    # keyed on the canonical local form, so "+92…" on the card and "0300…" from the model
    # (or the other way round) are the same pair
    assert _resolved_pairs_from_messages(items) == {("easypaisa", "03135468810")}


def test_resolved_pairs_from_messages_ignores_non_recipient_cards():
    from app.conversation import _resolved_pairs_from_messages

    items = [
        {"role": "assistant", "text": "Your balance is ₨84,500.",
         "cards": [{"kind": "balance", "balancePaisa": 8_450_000}]},
    ]
    assert _resolved_pairs_from_messages(items) == set()


# --- multi-turn state: each POST /converse rebuilds history from persisted messages ---

def chat_store(fake_backend):
    """Stateful fake of the backend chat API: sessions + messages (with cards)."""
    items: list[dict] = []

    def create_session(req):
        return httpx.Response(201, json={"success": True, "data": {
            "id": "sessM", "title": None, "createdAt": "2026-09-02T00:00:00Z"}})

    def add_message(req):
        body = body_of(req)
        item = {"id": f"m{len(items) + 1}", "role": body["role"], "text": body["text"],
                "cards": body.get("cards") or [], "createdAt": "2026-09-02T00:00:00Z"}
        items.append(item)
        return httpx.Response(201, json={"success": True, "data": item})

    fake_backend.route("POST", "/api/v1/chat/sessions", responder=create_session)
    fake_backend.route("POST", "/api/v1/chat/sessions/sessM/messages", responder=add_message)
    fake_backend.route("GET", "/api/v1/chat/sessions/sessM/messages", responder=lambda req: httpx.Response(
        200, json={"success": True, "data": {"items": items}}))
    return items


async def run_turn(fake_backend, text, model, session_id=None):
    """One converse_turn against the fake backend; returns (cards, session_id)."""
    from app.conversation import converse_turn
    from app.backend_client import BackendClient

    client = BackendClient("jwt", transport=fake_backend.transport)
    cards, sid = [], session_id
    try:
        async for ev in converse_turn(
            client, text=text, audio=None, audio_mime=None, session_id=session_id,
            language="en", tts=StubTts(), transcriber=FakeTranscriber(), model=model,
        ):
            data = json.loads(ev["data"])
            if ev["event"] == "card":
                cards.append(data["card"])
            elif ev["event"] == "done":
                sid = data["sessionId"]
            elif ev["event"] == "error":
                raise AssertionError(f"turn errored: {data}")
    finally:
        await client.aclose()
    return cards, sid


PENDING_SEND = {
    "id": "actM", "kind": "send_money", "amountPaisa": 10000, "feePaisa": 0,
    "summary": {"en": "Send ₨100 to Sara Khan", "ur": "ثارہ خان کو ₨100 بھیجیں"},
    "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
}
INSTITUTIONS = {"items": [
    {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet", "popular": True},
    {"id": "jazzcash", "name": "JazzCash", "urduName": "جاز کیش", "kind": "wallet", "popular": True},
]}


async def test_three_turn_send_keeps_recipient_across_turns(fake_backend):
    """turn1 chips -> turn2 recipient card -> turn3 'Yes, continue' must produce a
    confirmation using the ids from the [cards] history line, with NO second resolve call."""
    from tests.test_agent import RecordingFakeToolModel

    chat_store(fake_backend)
    fake_backend.route("GET", "/api/v1/institutions", INSTITUTIONS)
    fake_backend.route("POST", "/api/v1/transfers/resolve", {
        "title": "Sara Khan",
        "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
        "identifier": "+923135468810", "linkedUserId": "u9",
    })
    fake_backend.route("POST", "/api/v1/transfers", PENDING_SEND)

    cards1, sid = await run_turn(fake_backend, "pay 100 rupees to 03135468810", scripted([
        AIMessage(content="", tool_calls=[{"name": "list_institutions", "args": {}, "id": "t1"}]),
        AIMessage(content="Which wallet is that number with?"),
    ]))
    assert [c["kind"] for c in cards1] == ["institution_chips"]

    cards2, sid = await run_turn(fake_backend, "Easypaisa", scripted([
        AIMessage(content="", tool_calls=[{"name": "resolve_recipient", "args": {
            "institution_id": "easypaisa", "identifier": "+923135468810"}, "id": "t2"}]),
        AIMessage(content="Send ₨100 to Sara Khan at Easypaisa?"),
    ]), session_id=sid)
    assert [c["kind"] for c in cards2] == ["recipient"]

    # Turn 3: the model only carries the institution's NAME, as its history shows.
    model3 = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {
            "amount_paisa": 10000, "institution_name": "Easypaisa",
            "identifier": "+923135468810"}, "id": "t3"}]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ]))
    before = len([r for r in fake_backend.requests if r.url.path == "/api/v1/transfers/resolve"])
    cards3, sid = await run_turn(fake_backend, "Yes, continue", model3, session_id=sid)

    assert [c["kind"] for c in cards3] == ["confirmation"]
    assert cards3[0]["actionId"] == "actM"
    # no re-resolve on the confirmation turn
    after = len([r for r in fake_backend.requests if r.url.path == "/api/v1/transfers/resolve"])
    assert after == before
    # the transfer carried the right institution + identifier
    transfer = body_of([r for r in fake_backend.requests if r.url.path == "/api/v1/transfers"][-1])
    assert transfer["to"] == {"institutionId": "easypaisa", "identifier": "+923135468810"}
    # and the model actually saw the machine-readable card facts in its history
    history_text = "\n".join(str(m.content) for m in model3.received[0])
    assert "[cards] recipient: institution_id=easypaisa" in history_text
    assert "identifier=+923135468810" in history_text
    assert "title=Sara Khan" in history_text
    assert "[cards] institution_chips: easypaisa:Easypaisa" in history_text


async def test_two_turn_bill_pays_from_bill_card_in_history(fake_backend):
    """A `bill` card shown in turn 1 must let turn 2's 'yes' call pay_bill(bill_id)
    straight from the history line — no second lookup."""
    from tests.test_agent import RecordingFakeToolModel

    chat_store(fake_backend)
    fake_backend.route("GET", "/api/v1/billers", {"items": [
        {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"}]})
    fake_backend.route("POST", "/api/v1/bills/lookup", {
        "billId": "bill7", "consumerName": "Ammi Jaan", "amountPaisa": 432000,
        "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08"})
    fake_backend.route("POST", "/api/v1/bills/pay", {
        "id": "actB", "kind": "pay_bill", "amountPaisa": 432000, "feePaisa": 0,
        "summary": {"en": "Pay K-Electric ₨4,320", "ur": "کے الیکٹرک ₨4,320"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending"})

    # Turn 1 uses biller_name only — it must be mapped to the biller id.
    cards1, sid = await run_turn(fake_backend, "pay my K-Electric bill 0400012345678", scripted([
        AIMessage(content="", tool_calls=[{"name": "lookup_bill", "args": {
            "biller_name": "K-Electric", "consumer_no": "0400012345678"}, "id": "t1"}]),
        AIMessage(content="Your K-Electric bill is ₨4,320. Pay it?"),
    ]))
    assert [c["kind"] for c in cards1] == ["bill"]
    assert cards1[0]["billId"] == "bill7"

    model2 = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[{"name": "pay_bill", "args": {"bill_id": "bill7"}, "id": "t2"}]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ]))
    lookups_before = len([r for r in fake_backend.requests if r.url.path == "/api/v1/bills/lookup"])
    cards2, sid = await run_turn(fake_backend, "yes", model2, session_id=sid)

    assert [c["kind"] for c in cards2] == ["confirmation"]
    assert cards2[0]["actionId"] == "actB"
    assert len([r for r in fake_backend.requests if r.url.path == "/api/v1/bills/lookup"]) == lookups_before
    history_text = "\n".join(str(m.content) for m in model2.received[0])
    assert "[cards] bill: bill_id=bill7 biller=K-Electric" in history_text
    assert "amount_paisa=432000" in history_text


async def test_send_money_accepts_institution_name_and_maps_it_to_an_id(fake_backend):
    """Name-only send (no prior resolve in this run): institution_name -> real id."""
    from app.agent import run_agent
    from app.backend_client import BackendClient

    fake_backend.route("GET", "/api/v1/institutions", INSTITUTIONS)
    fake_backend.route("POST", "/api/v1/transfers", PENDING_SEND)
    client = BackendClient("jwt", transport=fake_backend.transport)
    resolved = {("easypaisa", "+923135468810")}  # confirmed in an earlier turn
    _, cards = await run_agent(client, [], "Yes, continue", "en", model=scripted([
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {
            "amount_paisa": 10000, "institution_name": "Easypaisa",
            "identifier": "+923135468810"}, "id": "t1"}]),
        AIMessage(content="Please confirm on the card."),
    ]), resolved_pairs=resolved)
    await client.aclose()
    assert cards[-1]["kind"] == "confirmation"
    transfer = body_of([r for r in fake_backend.requests if r.url.path == "/api/v1/transfers"][-1])
    assert transfer["to"]["institutionId"] == "easypaisa"


async def test_tts_uses_the_turn_language_not_the_ui_language(fake_backend, wired_app):
    """Urdu-script input under an English UI replies in Urdu — so the voice and the Urdu
    number-words pass must be asked for with 'ur', not the UI's 'en'."""
    wire_routes(fake_backend)
    calls = []

    class RecordingTts:
        is_stub = True

        async def synthesize(self, text, language):
            calls.append((text, language))
            return "aud1"

    wired_app.state.model_override = scripted([AIMessage(content="آپ کا بیلنس 81800 روپے ہے۔")])
    wired_app.state.tts = RecordingTts()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post("/converse", json={"text": "میرا بیلنس کیا ہے؟", "language": "en"},
                                headers={"Authorization": "Bearer jwt1"})
    assert res.status_code == 200
    assert calls and calls[-1][1] == "ur"
    wired_app.state.tts = StubTts()


def test_is_no_speech_covers_the_sentinel_empties_and_narrations():
    from app.conversation import is_no_speech

    for text in ["", "   ", "NO_SPEECH", "no_speech.", None,
                 "There is no speech in the audio. The audio contains a ball bouncing.",
                 "کوئی آواز نہیں آ رہی"]:
        assert is_no_speech(text), text
    for text in ["میرا بیلنس کیا ہے؟", "What is my balance?", "no, cancel that"]:
        assert not is_no_speech(text), text


async def test_no_speech_audio_turn_answers_without_running_the_agent(fake_backend, wired_app):
    """A silent clip must not become a chat turn: no agent run, no persisted user message,
    just a short spoken 'say it again' in the UI language."""
    wire_routes(fake_backend)

    class SilentTranscriber:
        async def transcribe(self, audio, mime_type, language):
            return "NO_SPEECH"

    wired_app.state.transcriber = SilentTranscriber()
    wired_app.state.model_override = scripted([AIMessage(content="SHOULD NOT BE USED")])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post(
            "/converse",
            files={"audio": ("clip.m4a", b"\x00\x01", "audio/m4a")},
            data={"language": "ur"},
            headers={"Authorization": "Bearer jwt1"},
        )
    assert res.status_code == 200
    body = res.text
    assert "معاف کیجیے" in body
    assert "event: transcript" in body and 'data: {"text": ""}' in body
    assert "event: audio" in body and "event: done" in body
    assert "event: card" not in body
    # nothing was written to the chat history
    assert not [r for r in fake_backend.requests if r.url.path.endswith("/messages")
                and r.method == "POST"]


async def test_narrated_silence_is_also_treated_as_no_speech(fake_backend, wired_app):
    wire_routes(fake_backend)

    class NarratingTranscriber:
        async def transcribe(self, audio, mime_type, language):
            return "There is no speech in the audio. The audio contains the sound of a ball bouncing."

    wired_app.state.transcriber = NarratingTranscriber()
    wired_app.state.model_override = scripted([AIMessage(content="SHOULD NOT BE USED")])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=wired_app), base_url="http://test") as client:
        res = await client.post(
            "/converse",
            files={"audio": ("clip.m4a", b"\x00\x01", "audio/m4a")},
            data={"language": "en"},
            headers={"Authorization": "Bearer jwt1"},
        )
    assert res.status_code == 200
    assert "didn't catch that" in res.text
    assert "ball bouncing" not in res.text

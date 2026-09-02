from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from app.agent import run_agent
from app.backend_client import BackendClient

pytestmark = pytest.mark.asyncio


class FakeToolModel(GenericFakeChatModel):
    """Scripted chat model that supports bind_tools (returns itself)."""

    def bind_tools(self, tools: Any, **kwargs: Any):
        return self


def scripted(messages):
    return FakeToolModel(messages=iter(messages))


async def test_agent_calls_tool_then_answers_and_collects_card(fake_backend):
    fake_backend.route("GET", "/api/v1/me", {"user": {}, "account": {"balancePaisa": 8_450_000}, "card": {}})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="آپ کا بیلنس چوراسی ہزار پانچ سو روپے ہے۔"),
    ])
    reply, cards = await run_agent(client, [], "میرا بیلنس؟", "ur", model=model)
    assert "چوراسی" in reply
    assert cards == [{"kind": "balance", "balancePaisa": 8_450_000}]
    await client.aclose()


async def test_agent_send_money_flow_collects_confirmation(fake_backend):
    pending = {
        "id": "act9", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("GET", "/api/v1/contacts", {"items": [
        {"id": "c3", "name": "Bilal Ahmed", "urduName": "بلال احمد", "kind": "payo", "phone": "+923001110002"},
    ]})
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "search_contacts", "args": {"query": "بلال"}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {"amount_paisa": 150000, "contact_id": "c3"}, "id": "t2"}]),
        AIMessage(content="تصدیق کا کارڈ دیکھیں اور PIN ڈالیں۔"),
    ])
    reply, cards = await run_agent(client, [], "بلال کو 1500 بھیجو", "ur", model=model)
    assert cards[-1]["kind"] == "confirmation"
    assert cards[-1]["actionId"] == "act9"
    assert "تصدیق" in reply
    await client.aclose()


async def test_agent_reprompts_once_when_card_promised_but_no_tool_called(fake_backend):
    """Regression: live Gemini once said 'see the confirmation card' without calling send_money."""
    pending = {
        "id": "act10", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("GET", "/api/v1/contacts", {"items": [
        {"id": "c3", "name": "Bilal Ahmed", "urduName": "بلال احمد", "kind": "payo", "phone": "+923001110002"},
    ]})
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="آپ بلال احمد کو پندرہ سو روپے بھیج رہے ہیں۔ تصدیق کے لیے کارڈ دیکھیں۔"),  # narrated, no tool
        AIMessage(content="", tool_calls=[{"name": "search_contacts", "args": {"query": "بلال"}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {"amount_paisa": 150000, "contact_id": "c3"}, "id": "t2"}]),
        AIMessage(content="تصدیق کا کارڈ دیکھیں اور PIN ڈالیں۔"),
    ])
    reply, cards = await run_agent(client, [], "بلال کو 1500 بھیجو", "ur", model=model)
    assert [c["kind"] for c in cards] == ["confirmation"]
    assert cards[0]["actionId"] == "act10"
    assert "PIN" in reply
    await client.aclose()


async def test_agent_does_not_reprompt_plain_answers(fake_backend):
    """A reply with no card language and no card must not trigger the nudge (script has one message)."""
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([AIMessage(content="جی، میں مدد کے لیے حاضر ہوں۔")])
    reply, cards = await run_agent(client, [], "سلام", "ur", model=model)
    assert cards == [] and "حاضر" in reply
    await client.aclose()


async def test_agent_extracts_text_from_gemini_content_blocks(fake_backend):
    """Regression: Gemini 2.5 replied with content blocks + thinking signature; the raw list was spoken aloud."""
    fake_backend.route("GET", "/api/v1/me", {"user": {}, "account": {"balancePaisa": 100}, "card": {}})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content=[{"type": "text", "text": "آپ کا بیلنس ایک روپیہ ہے۔", "extras": {"signature": "abc"}}]),
    ])
    reply, cards = await run_agent(client, [], "بیلنس؟", "ur", model=model)
    assert reply == "آپ کا بیلنس ایک روپیہ ہے۔"
    assert cards and cards[0]["kind"] == "balance"
    await client.aclose()


def test_system_prompt_carries_todays_date_in_both_languages():
    from datetime import date
    from app.agent import system_prompt
    ur = system_prompt("ur", date(2026, 9, 2))
    en = system_prompt("en", date(2026, 9, 2))
    assert "2026-09-02" in ur and "ستمبر" in ur and "8/2026" in ur
    assert "2026-09-02" in en and "8/2026" in en
    jan = system_prompt("en", date(2026, 1, 15))
    assert "12/2025" in jan

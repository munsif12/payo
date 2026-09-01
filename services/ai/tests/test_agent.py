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

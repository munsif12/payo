from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from pydantic import Field

from app.agent import run_agent
from app.backend_client import BackendClient

pytestmark = pytest.mark.asyncio


class FakeToolModel(GenericFakeChatModel):
    """Scripted chat model that supports bind_tools (returns itself)."""

    def bind_tools(self, tools: Any, **kwargs: Any):
        return self


def scripted(messages):
    return FakeToolModel(messages=iter(messages))


class RecordingFakeToolModel(FakeToolModel):
    """FakeToolModel that also records the message list it was invoked with, per call —
    so a test can inspect the exact SystemMessage the model received."""

    received: list[list[BaseMessage]] = Field(default_factory=list)

    def _generate(self, messages, stop=None, run_manager=None, **kwargs: Any):
        self.received.append(list(messages))
        return super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)


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


async def test_agent_pay_a_bill_intent_lists_then_pays_single_due_bill(fake_backend):
    """'pay a bill' intent: list_due_bills first, then (one bill) pay_bill immediately."""
    due = {"items": [
        {
            "billId": "b1", "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"},
            "consumerNo": "0400012345678", "amountPaisa": 432000, "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
        },
    ]}
    pending = {
        "id": "act11", "kind": "pay_bill", "amountPaisa": 432000, "feePaisa": 0,
        "summary": {"en": "Pay K-Electric ₨4,320", "ur": "کے الیکٹرک کا ₨4,320 بل ادا کریں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("GET", "/api/v1/bills/due", due)
    fake_backend.route("POST", "/api/v1/bills/pay", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "list_due_bills", "args": {}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "pay_bill", "args": {"bill_id": "b1"}, "id": "t2"}]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ])
    reply, cards = await run_agent(client, [], "I want to pay a bill", "en", model=model)
    assert [c["kind"] for c in cards] == ["bill", "confirmation"]
    assert cards[-1]["actionId"] == "act11"
    assert "PIN" in reply
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


async def test_agent_system_message_carries_english_reply_rule_for_roman_urdu_input(fake_backend):
    """Roman-Urdu input with language 'en': the model must actually receive the English
    reply-language rule in its SystemMessage, not the Urdu one — regression for the
    English-UI / Roman-Urdu-typing case."""
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([AIMessage(content="Sure, sending now.")]))
    reply, cards = await run_agent(client, [], "Bilal ko 1500 rupees bhejo", "en", model=model)
    assert model.received, "model was never invoked"
    system_msgs = [m for m in model.received[0] if isinstance(m, SystemMessage)]
    assert len(system_msgs) == 1
    sys_text = system_msgs[0].content
    assert "ALWAYS reply in English" in sys_text
    assert "ہمیشہ اردو میں ہی دیں" not in sys_text
    await client.aclose()


async def test_agent_system_message_carries_urdu_reply_rule_for_roman_urdu_input(fake_backend):
    """Mirror case: same Roman-Urdu input with language 'ur' — the model must receive the
    Urdu reply-language rule, not the English one."""
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([AIMessage(content="جی، ابھی بھیجتے ہیں۔")]))
    reply, cards = await run_agent(client, [], "Bilal ko 1500 rupees bhejo", "ur", model=model)
    assert model.received, "model was never invoked"
    system_msgs = [m for m in model.received[0] if isinstance(m, SystemMessage)]
    assert len(system_msgs) == 1
    sys_text = system_msgs[0].content
    assert "ہمیشہ اردو میں ہی دیں" in sys_text
    assert "ALWAYS reply in English" not in sys_text
    await client.aclose()


def test_system_prompt_carries_reply_language_rule_and_suggestion_intents():
    from app.agent import system_prompt

    en = system_prompt("en")
    ur = system_prompt("ur")

    # Reply-language rule: input may be en/Urdu-script/Roman Urdu, reply is always the UI language.
    assert "Roman Urdu" in en and "ALWAYS reply in English" in en
    assert "رومن اردو" in ur and "ہمیشہ اردو میں ہی دیں" in ur

    # The five suggestion intents, each paired with its starting tool.
    en_intents = [
        "I want to send money", "I want to pay a bill", "What is my balance?",
        "I want to top up a phone", "I need my statement",
    ]
    for intent in en_intents:
        assert intent in en
    for tool in ("search_contacts", "list_due_bills", "get_balance", "recharge", "get_statement"):
        assert tool in en and tool in ur

    ur_intents = [
        "میں پیسے بھیجنا چاہتا ہوں", "میں بل ادا کرنا چاہتا ہوں", "میرا بیلنس کیا ہے؟",
        "میں موبائل لوڈ کرانا چاہتا ہوں", "مجھے اسٹیٹمنٹ چاہیے",
    ]
    for intent in ur_intents:
        assert intent in ur

    # list_due_bills-first, single-bill-immediate-pay rule (R2.2), in both prompts.
    assert "list_due_bills" in en and "pay_bill(bill_id)" in en
    assert "list_due_bills" in ur and "pay_bill(bill_id)" in ur

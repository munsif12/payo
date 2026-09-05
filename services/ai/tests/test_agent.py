from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from pydantic import Field

from app.agent import run_agent
from app.backend_client import BackendClient
from app.lang import has_arabic_script

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
    fake_backend.route("GET", "/api/v1/recipients", {"items": [
        {"id": "c3", "nickname": "Bilal", "title": "Bilal Ahmed",
         "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
         "identifier": "+923001110002"},
    ]})
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "search_recipients", "args": {"query": "بلال"}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {"amount_paisa": 150000, "recipient_id": "c3"}, "id": "t2"}]),
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
    assert [c["kind"] for c in cards] == ["bills", "confirmation"]
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
    fake_backend.route("GET", "/api/v1/recipients", {"items": [
        {"id": "c3", "nickname": "Bilal", "title": "Bilal Ahmed",
         "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
         "identifier": "+923001110002"},
    ]})
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="آپ بلال احمد کو پندرہ سو روپے بھیج رہے ہیں۔ تصدیق کے لیے کارڈ دیکھیں۔"),  # narrated, no tool
        AIMessage(content="", tool_calls=[{"name": "search_recipients", "args": {"query": "بلال"}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "send_money", "args": {"amount_paisa": 150000, "recipient_id": "c3"}, "id": "t2"}]),
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
    for tool in ("search_recipients", "list_institutions", "list_saved_billers", "get_balance", "recharge", "get_statement"):
        assert tool in en and tool in ur

    ur_intents = [
        "میں پیسے بھیجنا چاہتا ہوں", "میں بل ادا کرنا چاہتا ہوں", "میرا بیلنس کیا ہے؟",
        "میں موبائل لوڈ کرانا چاہتا ہوں", "مجھے اسٹیٹمنٹ چاہیے",
    ]
    for intent in ur_intents:
        assert intent in ur

    # list_saved_billers-first, single-saved-biller-immediate-pay rule (V2.2), in both prompts.
    assert "list_saved_billers" in en and "pay_bill" in en
    assert "list_saved_billers" in ur and "pay_bill" in ur

    # Send-money policy: identifier without institution -> ask; never send before a
    # resolved+confirmed recipient card.
    assert "list_institutions" in en and "resolve_recipient" in en and "NEVER call send_money" in en
    assert "list_institutions" in ur and "resolve_recipient" in ur


async def test_agent_saved_biller_flow_lookup_then_pays(fake_backend):
    """'pay a bill' intent with one saved biller: list_saved_billers -> lookup_bill -> pay_bill."""
    fake_backend.route("GET", "/api/v1/saved-billers", {"items": [
        {"id": "sb1", "nickname": "Bijli",
         "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک"}, "consumerNo": "0400012345678"},
    ]})
    fake_backend.route("POST", "/api/v1/bills/lookup", {
        "billId": "b1", "consumerName": "Ammi Jaan", "amountPaisa": 432000,
        "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
    })
    fake_backend.route("GET", "/api/v1/billers", {"items": [
        {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"},
    ]})
    pending = {
        "id": "act12", "kind": "pay_bill", "amountPaisa": 432000, "feePaisa": 0,
        "summary": {"en": "Pay K-Electric ₨4,320", "ur": "کے الیکٹرک کا ₨4,320 بل ادا کریں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("POST", "/api/v1/bills/pay", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "list_saved_billers", "args": {}, "id": "t1"}]),
        AIMessage(content="", tool_calls=[{"name": "lookup_bill", "args": {"biller_id": "kel", "consumer_no": "0400012345678"}, "id": "t2"}]),
        AIMessage(content="", tool_calls=[{"name": "pay_bill", "args": {"bill_id": "b1"}, "id": "t3"}]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ])
    reply, cards = await run_agent(client, [], "I want to pay a bill", "en", model=model)
    assert [c["kind"] for c in cards] == ["bill", "confirmation"]
    assert cards[-1]["actionId"] == "act12"
    assert "PIN" in reply
    await client.aclose()


async def test_agent_number_without_institution_flow_shows_institution_chips(fake_backend):
    """A phone number with no bank/wallet named: list_institutions must be called and its
    chips card surfaced before resolve_recipient/send_money."""
    fake_backend.route("GET", "/api/v1/institutions", {"items": [
        {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet", "popular": True},
        {"id": "jazzcash", "name": "JazzCash", "urduName": "جاز کیش", "kind": "wallet", "popular": True},
    ]})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "list_institutions", "args": {}, "id": "t1"}]),
        AIMessage(content="کون سا بینک یا والٹ؟"),
    ])
    reply, cards = await run_agent(client, [], "0333 کو 100 روپے بھیجو", "ur", model=model)
    assert cards[-1]["kind"] == "institution_chips"
    assert [i["institutionId"] for i in cards[-1]["institutions"]] == ["easypaisa", "jazzcash"]
    await client.aclose()


async def test_agent_send_money_blocked_without_prior_resolve_recipient(fake_backend):
    """Guard: send_money(institution_id, identifier) must be rejected — no confirmation
    card — unless resolve_recipient was called for that exact pair earlier this turn."""
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{
            "name": "send_money",
            "args": {"amount_paisa": 150000, "institution_id": "easypaisa", "identifier": "+923001110002"},
            "id": "t1",
        }]),
        AIMessage(content="Please tell me which bank or wallet first."),
    ])
    reply, cards = await run_agent(client, [], "Send 1500 to +923001110002", "en", model=model)
    assert cards == []
    assert not fake_backend.requests  # /transfers was never called
    await client.aclose()


async def test_agent_send_money_allowed_after_resolve_recipient(fake_backend):
    """Same pair, but resolve_recipient ran first this turn: send_money proceeds and
    returns a confirmation card."""
    fake_backend.route("POST", "/api/v1/transfers/resolve", {
        "title": "Bilal Ahmed",
        "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
        "identifier": "+923001110002",
    })
    pending = {
        "id": "act13", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{
            "name": "resolve_recipient",
            "args": {"institution_id": "easypaisa", "identifier": "+923001110002"}, "id": "t1",
        }]),
        AIMessage(content="", tool_calls=[{
            "name": "send_money",
            "args": {"amount_paisa": 150000, "institution_id": "easypaisa", "identifier": "+923001110002"},
            "id": "t2",
        }]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ])
    reply, cards = await run_agent(client, [], "Send 1500 to Bilal Ahmed at Easypaisa +923001110002", "en", model=model)
    assert [c["kind"] for c in cards] == ["recipient", "confirmation"]
    assert cards[-1]["actionId"] == "act13"
    await client.aclose()


async def test_agent_send_money_allowed_when_resolve_recipient_ran_in_a_prior_turn(fake_backend):
    """Regression: resolve_recipient's confirmation may land in an earlier HTTP turn than
    the user's "yes, continue" — the guard's bookkeeping must not reset between turns, or
    the model gets rejected and loops back to re-showing the same recipient card forever.
    The caller (conversation.py) derives `resolved_pairs` from the recipient cards already
    in chat history and passes it in; here we simulate that directly."""
    pending = {
        "id": "act14", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{
            "name": "send_money",
            "args": {"amount_paisa": 150000, "institution_id": "easypaisa", "identifier": "+923001110002"},
            "id": "t1",
        }]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ])
    reply, cards = await run_agent(
        client, [], "Yes, continue", "en", model=model,
        resolved_pairs={("easypaisa", "+923001110002")},
    )
    assert [c["kind"] for c in cards] == ["confirmation"]
    assert cards[-1]["actionId"] == "act14"
    await client.aclose()


async def test_agent_send_money_allowed_when_model_passes_institution_name_instead_of_id(fake_backend):
    """Regression: on a later turn the model may only have the institution's display name in
    its own history (a prior reply reads "...at Easypaisa...", not the opaque id) and pass
    that as institution_id to send_money. The guard should recognize it refers to the same
    already-confirmed pair (via a name lookup) rather than reject it."""
    fake_backend.route("GET", "/api/v1/institutions", {
        "items": [{"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"}],
    })
    pending = {
        "id": "act15", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
    }
    fake_backend.route("POST", "/api/v1/transfers", pending)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{
            "name": "send_money",
            "args": {"amount_paisa": 150000, "institution_id": "Easypaisa", "identifier": "+923001110002"},
            "id": "t1",
        }]),
        AIMessage(content="Please confirm on the card and enter your PIN."),
    ])
    reply, cards = await run_agent(
        client, [], "Yes, continue", "en", model=model,
        resolved_pairs={("easypaisa", "+923001110002")},
    )
    assert [c["kind"] for c in cards] == ["confirmation"]
    assert cards[-1]["actionId"] == "act15"
    await client.aclose()


# --- prose-instead-of-tool nudge ---

INSTITUTIONS_DATA = {"items": [
    {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet", "popular": True},
    {"id": "jazzcash", "name": "JazzCash", "urduName": "جاز کیش", "kind": "wallet", "popular": True},
]}


async def test_prose_bank_question_is_nudged_into_list_institutions(fake_backend):
    """Turn 1 of a send: the model asks 'which bank or wallet?' in prose with no tool call.
    One nudge must turn that into a real institution_chips card."""
    fake_backend.route("GET", "/api/v1/institutions", INSTITUTIONS_DATA)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="Which bank or wallet is this number with?"),
        AIMessage(content="", tool_calls=[{"name": "list_institutions", "args": {}, "id": "t1"}]),
        AIMessage(content="Please tap the wallet this number belongs to."),
    ]))
    reply, cards = await run_agent(client, [], "pay 100 rupees to 03135468810", "en", model=model)
    await client.aclose()
    assert [c["kind"] for c in cards] == ["institution_chips"]
    assert "tap" in reply.lower()
    nudges = [m for call in model.received for m in call
              if "asked for the bank/wallet in prose" in str(m.content)]
    assert nudges, "institution nudge was never sent"


async def test_prose_biller_question_is_nudged_into_list_saved_billers(fake_backend):
    fake_backend.route("GET", "/api/v1/saved-billers", {"items": [
        {"id": "sb1", "nickname": "Ghar ka bijli",
         "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"},
         "consumerNo": "0400012345678"},
        {"id": "sb2", "nickname": "Gas",
         "biller": {"id": "ssgc", "name": "SSGC", "urduName": "ایس ایس جی سی", "category": "gas"},
         "consumerNo": "0400099999999"},
    ]})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="Which biller is it, and what is your consumer number?"),
        AIMessage(content="", tool_calls=[{"name": "list_saved_billers", "args": {}, "id": "t1"}]),
        AIMessage(content="Please tap the biller you want to pay."),
    ]))
    reply, cards = await run_agent(client, [], "I want to pay a bill", "en", model=model)
    await client.aclose()
    assert [c["kind"] for c in cards] == ["biller_chips"]
    nudges = [m for call in model.received for m in call
              if "asked for the biller/reference number in prose" in str(m.content)]
    assert nudges, "biller nudge was never sent"


async def test_prose_nudge_does_not_fire_when_a_tool_already_ran(fake_backend):
    """A turn that DID call a tool must never be re-invoked by the prose nudge."""
    fake_backend.route("GET", "/api/v1/me", {"user": {}, "account": {"balancePaisa": 100}, "card": {}})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="Your balance is ₨1. Which bank or wallet did you mean?"),
    ]))
    await run_agent(client, [], "balance for 03135468810?", "en", model=model)
    await client.aclose()
    assert len(model.received) == 2  # initial + the post-tool turn, no nudge round


async def test_reply_never_leaks_the_cards_context_marker(fake_backend):
    """Gemini sometimes imitates the [cards] history format as its own reply — that text
    must never reach the app (it gets persisted and spoken)."""
    from app.agent import strip_cards_marker

    assert strip_cards_marker('Sara Khan is ready.\n[cards] recipient: id=x') == "Sara Khan is ready."
    assert strip_cards_marker('[cards]\n{"chips": ["HBL"]}') == ""

    fake_backend.route("GET", "/api/v1/me", {"user": {}, "account": {"balancePaisa": 100}, "card": {}})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content='[cards]\n{"balance_paisa": 100}'),
        AIMessage(content="SHOULD NOT BE REACHED — the turn already produced a card"),
    ])
    reply, cards = await run_agent(client, [], "balance?", "en", model=model)
    await client.aclose()
    assert "[cards]" not in reply
    # A card was emitted, so the turn is finished: speak a fixed line instead of re-invoking.
    assert reply == "Here you go." and cards[0]["kind"] == "balance"


async def test_marker_only_reply_with_no_card_is_still_re_prompted(fake_backend):
    """Without a card there is nothing on screen and nothing was acted on, so asking the
    model for a real sentence is safe."""
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content='[cards]\n{"balance_paisa": 100}'),
        AIMessage(content="Your balance is one rupee."),
    ])
    reply, cards = await run_agent(client, [], "balance?", "en", model=model)
    await client.aclose()
    assert reply == "Your balance is one rupee." and not cards


async def test_urdu_language_nudge_reply_is_also_stripped_of_the_marker(fake_backend):
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="Hello there."),  # English under language="ur" -> Urdu nudge
        AIMessage(content='سلام، میں حاضر ہوں۔\n[cards] recipient: institution_id=easypaisa'),
    ])
    reply, _ = await run_agent(client, [], "سلام", "ur", model=model)
    await client.aclose()
    assert "[cards]" not in reply
    assert reply == "سلام، میں حاضر ہوں۔"


async def test_all_guards_share_one_budget_of_at_most_three_invocations(fake_backend):
    """card guard + prose ask + Urdu language would each want a re-prompt; the shared
    budget caps the turn at the initial call plus MAX_NUDGES."""
    from app.agent import MAX_NUDGES

    client = BackendClient("jwt", transport=fake_backend.transport)
    prose = "Please confirm on the card. Which bank or wallet is this?"
    model = RecordingFakeToolModel(messages=iter([AIMessage(content=prose)] * 3))
    reply, cards = await run_agent(client, [], "send 100 to 03135468810", "ur", model=model)
    await client.aclose()
    assert cards == []
    assert len(model.received) == 1 + MAX_NUDGES == 3


# ---- spoken_text: card turns are spoken, so bullets and markdown never survive ----

def test_spoken_text_strips_bullets_and_markdown_from_a_listed_reply():
    from app.agent import spoken_text

    bulleted = (
        "Here are your last five transactions:\n"
        "* **142,928** to Meezan Savings\n"
        "- 4,320 to K-Electric\n"
        "• 1,500 to Bilal\n"
        "1. 500 to Sara\n"
        "2) 250 to _Jazz_\n"
    )
    spoken = spoken_text(bulleted)
    assert "*" not in spoken and "_" not in spoken and "•" not in spoken
    assert "\n" not in spoken
    assert not spoken.startswith("-")
    assert spoken.startswith("Here are your last five transactions:")
    assert "142,928 to Meezan Savings" in spoken and "250 to Jazz" in spoken


def test_spoken_text_keeps_urdu_quotes_dashes_and_plain_sentences_intact():
    from app.agent import spoken_text

    reply = "جی، یہ آپ کے پانچ لین دین ہیں — سب سے بڑا «میزان سیونگز» کو تھا۔"
    assert spoken_text(reply) == reply
    assert spoken_text("Sent 1,500 - the fee was zero.") == "Sent 1,500 - the fee was zero."


async def test_run_agent_reply_is_speakable_even_when_the_model_bullets_a_card_turn(fake_backend):
    """The app hides the text on card turns and speaks it, so a bulleted list must never
    reach the token stream or TTS."""
    from tests.fixtures_backend import TXN, wire_all

    wire_all(fake_backend)
    fake_backend.route("GET", "/api/v1/transactions", {"items": [TXN, TXN]})
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "list_transactions", "args": {"limit": 5}, "id": "t1"}]),
        AIMessage(content="Your recent transactions:\n* 1,500 to Bilal Ahmed\n* 1,500 to Bilal Ahmed"),
    ])
    reply, cards = await run_agent(client, [], "show my recent transactions", "en", model=model)
    assert cards[0]["kind"] == "transactions"
    assert "*" not in reply and "\n" not in reply
    await client.aclose()


async def test_generic_non_answer_is_nudged_into_calling_the_tool(fake_backend):
    """Spec §4.4 defect: "I can help you with your banking needs…" instead of an action.
    Seen live on a bare "help" — one nudge must turn it into the help tool + card."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="I can help you with your banking needs. I can show you your balance."),
        AIMessage(content="", tool_calls=[{"name": "help", "args": {}, "id": "t1"}]),
        AIMessage(content="Tap any of these to start."),
    ])
    reply, cards = await run_agent(client, [], "help", "en", model=model)
    assert [c["kind"] for c in cards] == ["help"]
    assert "banking needs" not in reply
    await client.aclose()


async def test_a_real_answer_is_not_nudged(fake_backend):
    """The guard must not fire on a normal tool-backed reply (it costs a model call)."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="Your balance is 84,500 rupees."),
    ])
    reply, cards = await run_agent(client, [], "balance?", "en", model=model)
    assert reply == "Your balance is 84,500 rupees." and cards[0]["kind"] == "balance"
    await client.aclose()


async def test_announcing_data_without_a_tool_is_nudged_into_calling_it(fake_backend):
    """Live miss: "Here is your card." with no tool call — the app hides the text and shows
    the card, so an unfetched announcement leaves the user with an empty turn."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="Here is your card. It shows the last four digits and the expiry."),
        AIMessage(content="", tool_calls=[{"name": "get_card", "args": {}, "id": "t1"}]),
        AIMessage(content="Your card ends in 9405 and is active."),
    ])
    reply, cards = await run_agent(client, [], "show my card", "en", model=model)
    assert [c["kind"] for c in cards] == ["card"]
    assert "9405" in reply
    await client.aclose()


async def test_announcement_guard_does_not_fire_when_a_tool_produced_the_card(fake_backend):
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_card", "args": {}, "id": "t1"}]),
        AIMessage(content="Here is your card; it ends in 9405."),
    ])
    reply, cards = await run_agent(client, [], "show my card", "en", model=model)
    assert reply == "Here is your card; it ends in 9405." and cards[0]["kind"] == "card"
    await client.aclose()


async def test_urdu_turn_gets_an_urdu_nudge_and_still_calls_the_tool(fake_backend):
    """Live UR miss: an English [SYSTEM CHECK] inside an Urdu turn read as noise and the
    model just repeated «یہ رہا آپ کا کارڈ» with no tool. The nudge is Urdu for Urdu turns."""
    from app.agent import ANNOUNCE_NUDGE_UR, NUDGE_UR
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="جی اماں جی، یہ رہا آپ کا کارڈ۔"),
        AIMessage(content="", tool_calls=[{"name": "get_card", "args": {}, "id": "t1"}]),
        AIMessage(content="جی، آپ کے کارڈ کے آخری چار ہندسے نو چار صفر پانچ ہیں۔"),
    ]))
    reply, cards = await run_agent(client, [], "میرا کارڈ دکھائیں", "ur", model=model)
    assert [c["kind"] for c in cards] == ["card"]
    nudges = [m.content for turn in model.received for m in turn
              if isinstance(m, HumanMessage) and "SYSTEM CHECK" in str(m.content)]
    assert nudges, "no nudge was sent"
    assert nudges[-1] in (ANNOUNCE_NUDGE_UR, NUDGE_UR), "the nudge reached an Urdu turn in English"
    assert has_arabic_script(nudges[-1])
    await client.aclose()


# ---- generic-non-answer guard: only the canned reply, never a clarification or refusal ----

def test_generic_nonanswer_matches_only_the_canned_reply():
    from app.agent import _is_generic_nonanswer

    canned = [
        "I can help you with your banking needs. I can show you your balance.",
        "I can help you with many banking tasks. Please tap one.",
        "میں آپ کی بینکنگ ضروریات میں مدد کر سکتی ہوں۔",
        "جی، میں آپ کی مدد کے لیے حاضر ہوں۔ نیچے سے چنیں۔",
    ]
    legitimate = [
        "I can help you with that — how much would you like to send?",       # clarification
        "I cannot help you with the full number; it is on the Card screen.",  # refusal
        "جی، کتنے پیسے بھیجنے ہیں؟",                                          # clarification
        "پورا نمبر میں نہیں بتا سکتی، وہ کارڈ سکرین پر ہے۔",                    # refusal
        "Your balance is 84,500 rupees.",
    ]
    for reply in canned:
        assert _is_generic_nonanswer(reply), reply
    for reply in legitimate:
        assert not _is_generic_nonanswer(reply), reply


async def test_a_clarifying_question_is_not_nudged(fake_backend):
    """A clarification must reach the user as-is — nudging it would bury the question."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([AIMessage(content="I can help you with that — how much would you like to send?")])
    reply, cards = await run_agent(client, [], "I want to send money to Bilal", "en", model=model)
    assert reply.endswith("?") and not cards
    await client.aclose()


async def test_prose_ask_for_a_network_is_nudged_into_list_telcos(fake_backend):
    """Live UR miss: «کس نیٹ ورک پر لوڈ کرانا ہے؟» in prose — a voice user cannot type one."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),
        AIMessage(content="", tool_calls=[{"name": "list_telcos", "args": {}, "id": "t1"}]),
        AIMessage(content="جی، نیچے سے نیٹ ورک چنیں۔"),
    ])
    reply, cards = await run_agent(client, [], "مجھے موبائل لوڈ کرانا ہے", "ur", model=model)
    assert [c["kind"] for c in cards] == ["telco_chips"]
    await client.aclose()


async def test_last_turn_model_calls_counts_the_nudges(fake_backend):
    """The QA smoke budgets on real invocations, so run_agent must report them."""
    import app.agent as agent_module
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    plain = scripted([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="Your balance is 84,500 rupees."),
    ])
    await run_agent(client, [], "balance?", "en", model=plain)
    assert agent_module.last_turn_model_calls == 1

    nudged = scripted([
        AIMessage(content="Here is your card. It ends in 9405."),   # no tool -> one nudge
        AIMessage(content="", tool_calls=[{"name": "get_card", "args": {}, "id": "t1"}]),
        AIMessage(content="Your card ends in 9405."),
    ])
    await run_agent(client, [], "show my card", "en", model=nudged)
    assert agent_module.last_turn_model_calls == 2
    await client.aclose()


def test_announced_noun_maps_to_the_one_tool_that_produces_it():
    from app.agent import announced_tool

    assert announced_tool("Here are your saved recipients.") == "list_recipients"
    assert announced_tool("یہ رہے آپ کے محفوظ رابطے۔") == "list_recipients"
    assert announced_tool("Here is your card.") == "get_card"
    assert announced_tool("Here are your pockets.") == "list_pockets"
    assert announced_tool("Here is your QR code.") == "get_my_qr"
    assert announced_tool("All done.") is None


async def test_announce_nudge_names_the_tool_for_the_announced_noun(fake_backend):
    """Live EN+UR miss: a generic 'call the right tool' nudge was ignored for
    "Here are your saved recipients." — the nudge now names list_recipients."""
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="Here are your saved recipients."),
        AIMessage(content="", tool_calls=[{"name": "list_recipients", "args": {}, "id": "t1"}]),
        AIMessage(content="You have one saved recipient, Sara Khan."),
    ]))
    reply, cards = await run_agent(client, [], "show my saved recipients", "en", model=model)
    assert [c["kind"] for c in cards] == ["recipients"]
    nudges = [str(m.content) for turn in model.received for m in turn
              if isinstance(m, HumanMessage) and "SYSTEM CHECK" in str(m.content)]
    assert nudges and "Call list_recipients now." in nudges[-1]
    await client.aclose()


def test_bare_help_utterances_are_recognised():
    from app.agent import _asks_for_help

    for text in ["help", "Help!", "menu", "What can you do?", "مدد", "میں آپ سے کیا پوچھ سکتا ہوں؟"]:
        assert _asks_for_help(text), text
    for text in ["send money to Bilal", "I need help paying my bill", "مجھے بل ادا کرنے میں مدد چاہیے"]:
        assert not _asks_for_help(text), text


async def test_help_answered_with_a_polite_question_is_still_nudged(fake_backend):
    """Live UR miss: a bare «مدد» answered «میں آپ کی کیا مدد کر سکتی ہوں؟» — a question, so
    the generic-non-answer guard skipped it, but the answer to "help" is the help CARD."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="میں آپ کی کیا مدد کر سکتی ہوں، اماں جی؟"),
        AIMessage(content="", tool_calls=[{"name": "help", "args": {}, "id": "t1"}]),
        AIMessage(content="جی، ان میں سے کوئی بھی چن لیں۔"),
    ])
    reply, cards = await run_agent(client, [], "مدد", "ur", model=model)
    assert [c["kind"] for c in cards] == ["help"]
    await client.aclose()


async def test_a_normal_clarifying_question_is_still_not_nudged(fake_backend):
    """The bare-help bypass must not make every question a nudge target."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([AIMessage(content="جی، کتنے پیسے بھیجنے ہیں؟")])
    reply, cards = await run_agent(client, [], "بلال کو پیسے بھیجنے ہیں", "ur", model=model)
    assert reply.endswith("؟") and not cards
    await client.aclose()


async def test_a_repeated_prose_chips_ask_is_nudged_twice(fake_backend):
    """Live UR miss: after one nudge the model re-asked «کس نیٹ ورک پر لوڈ کرانا ہے؟»
    verbatim; the chips ask gets a second attempt inside the same nudge budget."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),   # ignored the first nudge
        AIMessage(content="", tool_calls=[{"name": "list_telcos", "args": {}, "id": "t1"}]),
        AIMessage(content="جی، نیچے سے نیٹ ورک چنیں۔"),
    ])
    reply, cards = await run_agent(client, [], "مجھے موبائل لوڈ کرانا ہے", "ur", model=model)
    assert [c["kind"] for c in cards] == ["telco_chips"]
    await client.aclose()


async def test_echoing_the_previous_answer_is_nudged(fake_backend):
    """Live: after a spending card, "what can you do" was answered with the spending
    sentence verbatim and no tool ran — the new message went unanswered."""
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    previous = ("Last month, you spent 180,967 rupees. The largest was food.\n"
                "[cards] spending: total_out_paisa=18096700")
    history = [HumanMessage(content="What did I spend last month?"), AIMessage(content=previous)]
    model = scripted([
        AIMessage(content="Last month, you spent 180,967 rupees. The largest was food."),  # echo
        AIMessage(content="", tool_calls=[{"name": "help", "args": {}, "id": "t1"}]),
        AIMessage(content="Tap any of these to start."),
    ])
    reply, cards = await run_agent(client, history, "what can you do", "en", model=model)
    assert [c["kind"] for c in cards] == ["help"]
    assert "180,967" not in reply
    await client.aclose()


def test_echo_detection_normalises_punctuation_and_ignores_short_replies():
    from app.agent import _echoes_history

    history = [AIMessage(content="Here are your last five transactions; the largest was 142,928 rupees.")]
    assert _echoes_history("Here are your last five transactions - the largest was 142,928 rupees!", history)
    assert not _echoes_history("Your balance is 84,500 rupees.", history)
    assert not _echoes_history("جی", history)      # a short ack may legitimately repeat
    assert not _echoes_history("Anything else?", [])


# ---- deterministic fallbacks: the model holds its answer and nudging does not work ----

async def test_cancel_preroute_cancels_without_asking_the_model(fake_backend):
    """Live UR: «منسوخ کر دو» after a confirmation card routed to `help` and the pending
    action stayed alive. The action_id is in the history's own [cards] line — just cancel."""
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    fake_backend.route("POST", "/api/v1/actions/act9/cancel", {"cancelled": True})
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [
        HumanMessage(content="میرا کارڈ کھول دیں"),
        AIMessage(content="تصدیق کریں۔\n[cards] confirmation: action_id=act9 amount_paisa=0"),
    ]
    model = scripted([AIMessage(content="SHOULD NOT BE CALLED")])   # no model call at all
    reply, cards = await run_agent(client, history, "رہنے دو، منسوخ کر دو", "ur", model=model)
    assert "منسوخ" in reply and not cards
    assert [r.url.path for r in fake_backend.requests] == ["/api/v1/actions/act9/cancel"]
    await client.aclose()


async def test_cancel_preroute_is_english_for_english_turns(fake_backend):
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    fake_backend.route("POST", "/api/v1/actions/act9/cancel", {"cancelled": True})
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [
        HumanMessage(content="unfreeze my card"),
        AIMessage(content="Please confirm.\n[cards] confirmation: action_id=act9 amount_paisa=0"),
    ]
    reply, cards = await run_agent(client, history, "never mind, cancel that", "en",
                                   model=scripted([AIMessage(content="SHOULD NOT BE CALLED")]))
    assert reply.startswith("That is cancelled")
    await client.aclose()


async def test_cancel_falls_through_to_the_model_with_no_pending_action(fake_backend):
    """No confirmation in history -> nothing to cancel; the model handles the message."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([AIMessage(content="There is nothing pending to cancel right now.")])
    reply, cards = await run_agent(client, [], "cancel that", "en", model=model)
    assert reply == "There is nothing pending to cancel right now."
    assert not [r for r in fake_backend.requests if "/cancel" in r.url.path]
    await client.aclose()


async def test_cancel_preroute_falls_through_when_the_action_is_already_gone(fake_backend):
    """A stale action_id (already executed/expired) must not swallow the turn."""
    from langchain_core.messages import HumanMessage
    from tests.conftest import err
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    fake_backend.route("POST", "/api/v1/actions/act9/cancel",
                       responder=lambda req: err(410, "ACTION_GONE", "Action already handled"))
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [AIMessage(content="ok\n[cards] confirmation: action_id=act9 amount_paisa=0")]
    model = scripted([AIMessage(content="That one was already completed.")])
    reply, cards = await run_agent(client, history, "cancel that", "en", model=model)
    assert reply == "That one was already completed."
    await client.aclose()


async def test_prose_which_network_gets_the_chips_attached_even_if_the_model_refuses(fake_backend):
    """Live UR: the model re-asked «کس نیٹ ورک پر لوڈ کرانا ہے؟» through every nudge. A voice
    user cannot type a network, so the chips are fetched and attached to its own sentence."""
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),
        AIMessage(content="جی، کس نیٹ ورک پر لوڈ کرانا ہے؟"),
    ])
    reply, cards = await run_agent(client, [], "مجھے موبائل لوڈ کرانا ہے", "ur", model=model)
    assert [c["kind"] for c in cards] == ["telco_chips"]
    assert "کس نیٹ ورک" in reply          # the model's sentence stays as the spoken prompt
    assert len(cards[0]["telcos"]) == 2
    await client.aclose()


async def test_english_prose_which_network_also_gets_chips(fake_backend):
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="Which network do you want to top up?"),
        AIMessage(content="Which network do you want to top up?"),
        AIMessage(content="Which network do you want to top up?"),
    ])
    reply, cards = await run_agent(client, [], "I want to top up a phone", "en", model=model)
    assert [c["kind"] for c in cards] == ["telco_chips"]
    await client.aclose()


async def test_chips_fallback_does_not_fire_when_the_tool_already_ran(fake_backend):
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "list_telcos", "args": {}, "id": "t1"}]),
        AIMessage(content="Which network do you want?"),
    ])
    reply, cards = await run_agent(client, [], "top up my phone", "en", model=model)
    assert [c["kind"] for c in cards] == ["telco_chips"]   # exactly one, not two
    await client.aclose()


# ---- regression: a turn that already acted must never be re-invoked ----

async def test_language_switch_emits_exactly_one_profile_card(fake_backend):
    """Live regression (UI ur, "switch to english"): update_profile('en') ran and the reply
    was correctly English, so the Urdu-language nudge re-invoked the turn and the model
    called update_profile('ur') — two profile cards, and the app stayed in Urdu."""
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    fake_backend.route("PATCH", "/api/v1/me",
                       {"id": "u1", "name": "Ammi Jaan", "urduName": "امی", "language": "en"})
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [
        HumanMessage(content="میرا بیلنس کیا ہے؟"),
        AIMessage(content="آپ کا بیلنس اکیاسی ہزار آٹھ سو روپے ہے۔\n[cards] balance: balance_paisa=8180000"),
    ]
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[
            {"name": "update_profile", "args": {"language": "en"}, "id": "t1"}]),
        AIMessage(content="Okay, I will speak English from now on."),
        # anything after this would be a second, forbidden invocation:
        AIMessage(content="", tool_calls=[
            {"name": "update_profile", "args": {"language": "ur"}, "id": "t2"}]),
        AIMessage(content="جی، اب اردو میں بات کروں گی۔"),
    ]))
    reply, cards = await run_agent(client, history, "switch to english", "ur", model=model)

    assert [c["kind"] for c in cards] == ["profile"], "more than one card = the turn re-ran"
    assert cards[0]["language"] == "en"
    assert cards[0]["applied"] == ["language"]
    assert reply == "Okay, I will speak English from now on."   # English reply is correct here
    assert len(model.received) == 2, "the turn was re-invoked after it had already acted"
    patches = [r for r in fake_backend.requests if r.method == "PATCH"]
    assert len(patches) == 1
    await client.aclose()


async def test_no_guard_re_invokes_once_a_card_exists(fake_backend):
    """Belt and braces across guards: a card-bearing turn whose reply would otherwise trip
    the announce/echo/generic/language guards must still cost exactly one invocation."""
    from langchain_core.messages import HumanMessage
    from tests.fixtures_backend import wire_all
    import app.agent as agent_module

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [AIMessage(content="Here are your pockets.\n[cards] pockets: p1:Umrah(12200000)")]
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[{"name": "list_pockets", "args": {}, "id": "t1"}]),
        # announces data, echoes history, is English on an Urdu turn — all guards would fire
        AIMessage(content="Here are your pockets."),
        AIMessage(content="SHOULD NOT BE REACHED"),
    ]))
    reply, cards = await run_agent(client, history, "میری پاکٹس دکھائیں", "ur", model=model)
    assert [c["kind"] for c in cards] == ["pockets"]
    assert agent_module.last_turn_model_calls == 1, "the turn was re-invoked"
    assert len(model.received) == 2   # one ReAct run: tool decision + final answer
    await client.aclose()


async def test_empty_reply_with_a_card_is_filled_without_a_model_call(fake_backend):
    """A card plus a sanitized-away sentence: say one fixed line, don't re-invoke."""
    from tests.fixtures_backend import wire_all
    import app.agent as agent_module

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = RecordingFakeToolModel(messages=iter([
        AIMessage(content="", tool_calls=[{"name": "get_balance", "args": {}, "id": "t1"}]),
        AIMessage(content="[cards] balance: balance_paisa=8180000"),   # sanitizes to ""
        AIMessage(content="SHOULD NOT BE REACHED"),
    ]))
    reply, cards = await run_agent(client, [], "میرا بیلنس؟", "ur", model=model)
    assert cards and cards[0]["kind"] == "balance"
    assert reply == "جی، یہ حاضر ہے۔"
    assert agent_module.last_turn_model_calls == 1, "the turn was re-invoked"
    assert len(model.received) == 2
    await client.aclose()


def test_echo_detection_never_compares_a_reply_with_itself():
    """_echoes_history reads prior turns only — the current reply is never in `history`."""
    from app.agent import _echoes_history

    reply = "Here are your last five transactions; the largest was 142,928 rupees."
    assert not _echoes_history(reply, [])
    assert not _echoes_history(reply, [AIMessage(content="Your balance is 84,500 rupees.")])
    assert _echoes_history(reply, [AIMessage(content=reply)])


# ---- v6: the pressure-language flag is sticky, not left to the model's memory ----


async def test_a_flagged_conversation_reflags_a_later_send_the_model_forgot(fake_backend):
    """Once a check_in card has been shown for `pressure_language`, every later send in the
    window carries the flag — even when the model omits risk_flags entirely. Otherwise a
    scam turn silently un-flags itself on the retry and the check-in is skipped."""
    from langchain_core.messages import AIMessage as _AIMessage, HumanMessage

    from tests.conftest import body_of
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    history = [
        HumanMessage(content="someone called and said my account will be blocked"),
        _AIMessage(content="Did someone ask you to send this?\n"
                           "[cards] check_in: action_id=act_flag risk_flags=pressure_language"),
    ]
    model = scripted([
        # no risk_flags at all — the model forgot
        AIMessage(content="", tool_calls=[{"name": "send_money",
                                           "args": {"amount_paisa": 500000, "recipient_id": "rec1"},
                                           "id": "t1"}]),
        AIMessage(content="Just one question first."),
    ])
    _reply, cards = await run_agent(client, history, "send it anyway", "en", model=model)
    transfer = next(r for r in fake_backend.requests if r.url.path == "/api/v1/transfers")
    assert body_of(transfer)["riskFlags"] == ["pressure_language"]
    assert [c["kind"] for c in cards] == ["check_in"]
    await client.aclose()


async def test_an_unflagged_conversation_does_not_invent_risk_flags(fake_backend):
    from tests.conftest import body_of
    from tests.fixtures_backend import wire_all

    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    model = scripted([
        AIMessage(content="", tool_calls=[{"name": "send_money",
                                           "args": {"amount_paisa": 500000, "recipient_id": "rec1"},
                                           "id": "t1"}]),
        AIMessage(content="Please confirm on the card."),
    ])
    _reply, cards = await run_agent(client, [], "send 5000 to Bilal", "en", model=model)
    transfer = next(r for r in fake_backend.requests if r.url.path == "/api/v1/transfers")
    assert "riskFlags" not in body_of(transfer)
    assert [c["kind"] for c in cards] == ["confirmation"]
    await client.aclose()


def test_risk_flags_in_history_reads_only_check_in_facts():
    """The assistant's own calm scam explanation names every signal — it must never be read
    back as evidence that the conversation is flagged."""
    from langchain_core.messages import AIMessage as _AIMessage, HumanMessage

    from app.agent import risk_flags_in_history
    from app.tools import SCAM_EXPLANATION

    assert risk_flags_in_history([
        _AIMessage(content="ok\n[cards] check_in: action_id=a1 risk_flags=pressure_language,new_recipient_large"),
    ]) == {"pressure_language", "new_recipient_large"}
    assert risk_flags_in_history([_AIMessage(content=SCAM_EXPLANATION["en"])]) == set()
    assert risk_flags_in_history([_AIMessage(content=SCAM_EXPLANATION["ur"])]) == set()
    assert risk_flags_in_history([HumanMessage(content="risk_flags=pressure_language")]) == set()

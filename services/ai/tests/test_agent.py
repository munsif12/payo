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
        AIMessage(content="Your balance is one rupee."),
    ])
    reply, _ = await run_agent(client, [], "balance?", "en", model=model)
    await client.aclose()
    assert "[cards]" not in reply
    assert reply == "Your balance is one rupee."


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

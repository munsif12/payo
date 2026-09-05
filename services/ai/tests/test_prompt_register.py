# -*- coding: utf-8 -*-
"""Urdu register + intent-table rules for the system prompts (spec §4.3, §4.4, §5)."""
from app.agent import INTENT_TABLE, SYSTEM_PROMPT_EN, SYSTEM_PROMPT_UR, system_prompt

# Written-register words the spoken Urdu prompt must never contain (spec §5).
BANNED_UR_WORDS = ["تفصیلات", "درج ذیل", "مہیا", "فراہم کردہ"]


def test_urdu_prompt_avoids_written_register_words():
    present = [w for w in BANNED_UR_WORDS if w in SYSTEM_PROMPT_UR]
    assert present == [], f"written-register words in SYSTEM_PROMPT_UR: {present}"
    assert present == [w for w in BANNED_UR_WORDS if w in system_prompt("ur")]


def test_urdu_prompt_asks_for_short_warm_spoken_replies_with_spoken_numbers():
    assert "دو چھوٹے جملے" in SYSTEM_PROMPT_UR       # at most two short sentences
    assert "جی" in SYSTEM_PROMPT_UR                   # warm address
    assert "اکیاسی ہزار آٹھ سو روپے" in SYSTEM_PROMPT_UR  # numbers said the spoken way
    assert "ہندسے نہ لکھیں" in SYSTEM_PROMPT_UR


def test_intent_table_is_in_both_prompts():
    assert INTENT_TABLE in SYSTEM_PROMPT_EN
    assert INTENT_TABLE in SYSTEM_PROMPT_UR


def test_intent_table_names_a_tool_for_every_v5_action():
    for tool in (
        "get_balance", "get_account", "update_profile", "help", "list_transactions",
        "get_transaction", "spending_summary", "get_statement", "list_statements",
        "get_card", "freeze_card", "unfreeze_card", "list_recipients", "delete_recipient",
        "cancel_action", "list_due_bills", "list_saved_billers", "delete_saved_biller",
        "list_telcos", "recharge", "list_pockets", "create_pocket", "pocket_deposit",
        "pocket_withdraw", "request_money", "list_requests", "approve_request",
        "decline_request", "get_my_qr", "send_money", "pay_bill",
    ):
        assert tool in INTENT_TABLE, f"{tool} missing from the intent table"
    # one line per §2 row
    assert len([l for l in INTENT_TABLE.splitlines() if l.startswith("|")]) >= 33


def test_policy_rules_are_in_both_prompts():
    en, ur = system_prompt("en"), system_prompt("ur")
    # last transaction -> receipt
    assert "limit=1" in en and "limit=1" in ur
    # compare periods in ONE call
    assert "compare_from" in en and "compare_from" in ur
    # card safety: freeze instant, unfreeze needs the PIN, full number refused
    assert "unfreeze_card" in en and "unfreeze_card" in ur
    assert "Card screen" in en and "کارڈ سکرین" in ur
    # language switch
    assert "update_profile(language)" in en and "update_profile(language)" in ur
    # never the generic non-answer
    assert "I can help you with your banking needs" in en


def test_card_turns_are_spoken_not_shown_rule_is_in_both_prompts():
    """The app hides the assistant text whenever a card is emitted and only speaks it, so
    both prompts must ask for a 2-sentence spoken gist with no list markup (spec §4.3)."""
    en, ur = system_prompt("en"), system_prompt("ur")
    assert "CARD TURNS ARE SPOKEN, NOT SHOWN" in en
    assert "TWO short sentences" in en
    assert "Never" in en and "enumerate the rows" in en
    assert "bullets, asterisks" in en and "markdown" in en
    assert "142,928 rupees to Meezan Savings" in en          # the shape of a good gist

    assert "کارڈ والی باری صرف سنی جاتی ہے" in ur
    assert "دو چھوٹے جملوں" in ur
    assert "ایک ایک قطار نہ گنوائیں" in ur
    assert "مارک ڈاؤن" in ur
    assert "میزان سیونگز" in ur


def test_help_and_no_unfetched_announcement_rules_are_in_both_prompts():
    """Live routing misses: "what can you do" answered in prose with no help card, and
    "here are your transactions with X" announced over an empty tool result."""
    en, ur = system_prompt("en"), system_prompt("ur")
    assert "what can I ask you" in en and "help card is the answer" in en
    assert "NEVER ANNOUNCE DATA YOU DID NOT FETCH" in en
    assert "a tool MUST have run this turn" in en
    assert "cancel_action with the action_id" in en

    assert "میں کیا پوچھ سکتا ہوں" in ur and "help کارڈ" in ur
    assert "اعلان کبھی نہ کریں" in ur
    assert "cancel_action" in ur


def test_request_money_and_pocket_creation_rules_are_in_both_prompts():
    en, ur = system_prompt("en"), system_prompt("ur")
    assert "call search_recipients(name) first" in en and "a goal is optional" in en
    assert "search_recipients" in ur and "ہدف (goal) ضروری نہیں" in ur


def test_urdu_prompt_maps_urdu_wordings_to_the_read_tools():
    """Live UR miss: «میرے محفوظ رابطے دکھائیں» was answered in prose with no tool."""
    ur = system_prompt("ur")
    for phrase, tool in [
        ("محفوظ رابطے", "list_recipients"), ("محفوظ بلر", "list_saved_billers"),
        ("واجب الادا بل", "list_due_bills"), ("پاکٹس", "list_pockets"),
        ("درخواستیں", "list_requests"), ("اسٹیٹمنٹس", "list_statements"),
        ("کیو آر", "get_my_qr"),
    ]:
        assert phrase in ur, phrase
        assert tool in ur, tool

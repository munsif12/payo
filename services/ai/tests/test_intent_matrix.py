# -*- coding: utf-8 -*-
"""Intent matrix (spec §2 / §4.4): every supported action, in English AND Urdu.

Scope: with a SCRIPTED model, each row proves the tool -> card wiring — that the named tool
really reaches the backend (the request it makes) and that the app gets the card kind the
spec promises. It does NOT prove the live model picks that tool for that utterance; the
routing gate is scripts/ai-smoke.py, which runs these same rows against the real model.
"""
import pytest
from langchain_core.messages import AIMessage

from app.agent import run_agent
from app.backend_client import BackendClient
from tests.fixtures_backend import wire_all
from tests.test_agent import scripted

pytestmark = pytest.mark.asyncio

DONE_EN = "Done."
DONE_UR = "جی، ہو گیا۔"
# C4 (full number / CVV) is answered by a prompt rule, so its reply is scripted as the
# refusal the rule requires and asserted below.
REFUSE_EN = "I cannot read the full number out. It is on the Card screen in the app."
REFUSE_UR = "پورا نمبر میں نہیں بتا سکتی۔ وہ ایپ کی کارڈ سکرین پر ہے۔"

# row_id, EN utterance, UR utterance, [(tool, args), ...], expected card kinds, backend path proof
MATRIX = [
    ("A1", "What is my balance?", "میرا بیلنس کیا ہے؟",
     [("get_balance", {})], ["balance"], "/api/v1/me"),
    ("A2", "Show my account details", "میرا اکاؤنٹ دکھائیں",
     [("get_account", {})], ["account"], "/api/v1/me"),
    ("A3", "Change my name to Ammi Jaan", "میرا نام امی جان کر دیں",
     [("update_profile", {"name": "Ammi Jaan"})], ["profile"], "/api/v1/me"),
    ("A4", "Switch to English", "انگریزی میں بدلیں",
     [("update_profile", {"language": "en"})], ["profile"], "/api/v1/me"),
    ("A5", "What can you do?", "آپ کیا کیا کر سکتی ہیں؟",
     [("help", {})], ["help"], None),
    # Live misses: the same intent worded differently must still reach the help tool.
    ("A5b", "What can I ask you?", "میں آپ سے کیا پوچھ سکتا ہوں؟",
     [("help", {})], ["help"], None),
    ("A5c", "help", "مدد",
     [("help", {})], ["help"], None),
    ("T1", "What was my last transaction?", "میرا آخری لین دین کیا تھا؟",
     [("list_transactions", {"limit": 1})], ["receipt"], "/api/v1/transactions"),
    ("T2", "Show my recent transactions", "میرے حالیہ لین دین دکھائیں",
     [("list_transactions", {"limit": 5})], ["transactions"], "/api/v1/transactions"),
    ("T3", "Show transactions with Bilal", "بلال کے ساتھ لین دین دکھائیں",
     [("list_transactions", {"q": "Bilal", "limit": 5})], ["transactions"], "/api/v1/transactions"),
    ("T4", "What did I spend last month?", "پچھلے مہینے کتنا خرچ ہوا؟",
     [("spending_summary", {"from_date": "2026-08-01", "to_date": "2026-08-31"})],
     ["spending"], "/api/v1/transactions/spending-summary"),
    ("T5", "How does that compare to the month before?", "اس سے پہلے والے مہینے سے موازنہ کریں",
     [("spending_summary", {"from_date": "2026-08-01", "to_date": "2026-08-31",
                            "compare_from": "2026-07-01", "compare_to": "2026-07-31"})],
     ["spending"], "/api/v1/transactions/spending-summary"),
    ("T6", "Show me the receipt for that transaction", "اس لین دین کی رسید دکھائیں",
     [("get_transaction", {"transaction_id": "txn1"})], ["receipt"], "/api/v1/transactions/txn1"),
    ("T7", "I need my August statement", "مجھے اگست کی اسٹیٹمنٹ چاہیے",
     [("get_statement", {"year": 2026, "month": 8})], ["statement"], "/api/v1/statements"),
    ("T8", "List my statements", "میری اسٹیٹمنٹس دکھائیں",
     [("list_statements", {})], ["statements"], "/api/v1/statements"),
    ("C1", "Show my card", "میرا کارڈ دکھائیں",
     [("get_card", {})], ["card"], "/api/v1/cards/mine"),
    ("C2", "Freeze my card", "میرا کارڈ بند کر دیں",
     [("freeze_card", {})], ["card"], "/api/v1/cards/mine/freeze"),
    ("C3", "Unfreeze my card", "میرا کارڈ کھول دیں",
     [("unfreeze_card", {})], ["confirmation"], "/api/v1/cards/mine/unfreeze"),
    # C4 is a prompt rule, not a tool: show the masked card and point at the Card screen.
    ("C4", "Read me my full card number", "میرا پورا کارڈ نمبر بتائیں",
     [("get_card", {})], ["card"], "/api/v1/cards/mine"),
    ("R1", "Show my saved recipients", "میرے محفوظ رابطے دکھائیں",
     [("list_recipients", {})], ["recipients"], "/api/v1/recipients"),
    ("R2", "Delete the saved recipient Bilal", "بلال کا محفوظ رابطہ مٹا دیں",
     [("delete_recipient", {"recipient_id": "rec1"})], [], "/api/v1/recipients/rec1"),
    ("R3", "Cancel that pending payment", "وہ زیرِ التوا ادائیگی منسوخ کر دیں",
     [("cancel_action", {"action_id": "act1"})], ["confirmation"], "/api/v1/actions/act1/cancel"),
    ("B1", "Which bills are due?", "کون سے بل واجب الادا ہیں؟",
     [("list_due_bills", {})], ["bills"], "/api/v1/bills/due"),
    ("B2", "Show the bills I already paid", "جو بل میں ادا کر چکی ہوں وہ دکھائیں",
     [("list_transactions", {"category": "bill", "limit": 5})], ["transactions"], "/api/v1/transactions"),
    ("B3", "Show my saved billers", "میرے محفوظ بلر دکھائیں",
     [("list_saved_billers", {"browse": True})], ["billers"], "/api/v1/saved-billers"),
    ("B3d", "Delete that saved biller", "وہ محفوظ بلر مٹا دیں",
     [("delete_saved_biller", {"saved_biller_id": "sb1"})], [], "/api/v1/saved-billers/sb1"),
    ("B4", "I want to top up a phone", "مجھے موبائل لوڈ کرانا ہے",
     [("list_telcos", {})], ["telco_chips"], "/api/v1/telcos"),
    ("P1", "Show my pockets", "میری پاکٹس دکھائیں",
     [("list_pockets", {})], ["pockets"], "/api/v1/pockets"),
    ("P2", "Create a pocket for Umrah", "عمرہ کے لیے ایک پاکٹ بنائیں",
     [("create_pocket", {"name": "Umrah Fund", "emoji": "🕋"})], ["pocket"], "/api/v1/pockets"),
    ("P3", "Put one thousand rupees in my Umrah pocket", "عمرہ پاکٹ میں ایک ہزار روپے ڈالیں",
     [("pocket_deposit", {"pocket_id": "p1", "amount_paisa": 100000})],
     ["confirmation"], "/api/v1/pockets/p1/deposit"),
    ("P4", "Take one thousand rupees out of my Umrah pocket", "عمرہ پاکٹ سے ایک ہزار روپے نکالیں",
     [("pocket_withdraw", {"pocket_id": "p1", "amount_paisa": 100000})],
     ["confirmation"], "/api/v1/pockets/p1/withdraw"),
    ("Q1", "Ask Sara for two thousand five hundred rupees", "سارہ سے ڈھائی ہزار روپے مانگیں",
     [("request_money", {"from_phone": "+923001110003", "amount_paisa": 250000})],
     ["request"], "/api/v1/requests"),
    ("Q2", "Who owes me money?", "مجھے کس نے پیسے دینے ہیں؟",
     [("list_requests", {"direction": "in"})], ["requests"], "/api/v1/requests"),
    ("Q3", "Approve that request", "وہ درخواست منظور کر دیں",
     [("approve_request", {"request_id": "req1"})], ["confirmation"], "/api/v1/requests/req1/approve"),
    ("Q4", "Decline that request", "وہ درخواست رد کر دیں",
     [("decline_request", {"request_id": "req1"})], [], "/api/v1/requests/req1/decline"),
    ("K1", "Show my QR code", "میرا QR کوڈ دکھائیں",
     [("get_my_qr", {})], ["qr"], "/api/v1/qr/mine"),
    # ---- v6: trusted contact, scam interruption, proactive greeting ----
    ("G1", "Who is my trusted contact?", "میرا بھروسے والا فرد کون ہے؟",
     [("get_guardian", {})], ["guardian"], "/api/v1/guardian"),
    ("G2", "Make Bilal my trusted contact", "بلال کو میرا بھروسے والا فرد بنا دیں",
     [("set_guardian", {"phone": "+923001110002"})], ["guardian"], "/api/v1/guardian"),
    ("G3", "Remove my trusted contact", "میرا بھروسے والا فرد ہٹا دیں",
     [("remove_guardian", {})], ["guardian"], "/api/v1/guardian"),
    ("G4", "What is waiting for my approval?", "کیا کچھ میری منظوری کا منتظر ہے؟",
     [("list_approvals", {})], ["approvals"], "/api/v1/approvals"),
    ("G5", "Approve that payment", "وہ ادائیگی منظور کر دیں",
     [("approve_action", {"action_id": "act_wait"})], ["approvals"], "/api/v1/approvals"),
    ("G6", "Decline that payment", "وہ ادائیگی رد کر دیں",
     [("decline_action", {"action_id": "act_wait"})], [], "/api/v1/approvals/act_wait/decline"),
    ("G7", "Remind Bilal about it", "بلال کو یاد دہانی بھیجیں",
     [("remind_guardian", {"action_id": "act_wait"})], [], "/api/v1/actions/act_wait/remind"),
    ("G8", "Yes, someone asked me to send it", "جی ہاں، کسی نے مجھ سے کہا تھا",
     [("answer_check_in", {"action_id": "act_flag", "someone_asked": True})],
     [], "/api/v1/actions/act_flag/check-in"),
    ("G9", "No, this is my own idea", "نہیں، یہ میرا اپنا فیصلہ ہے",
     [("answer_check_in", {"action_id": "act_flag", "someone_asked": False})],
     ["waiting_approval"], "/api/v1/actions/act_flag"),
    ("G10", "What is new?", "کیا نیا ہے؟",
     [("get_digest", {})], ["digest"], "/api/v1/me/digest"),
    ("G11", "Stop telling me my bills when I open the app",
     "ایپ کھولتے ہی مجھے بل نہ بتایا کریں",
     [("set_proactive", {"enabled": False})], [], "/api/v1/me"),
    ("G12", "Tell me what is new whenever I open the app",
     "جب بھی ایپ کھولوں مجھے بتا دیا کریں کہ کیا نیا ہے",
     [("set_proactive", {"enabled": True})], [], "/api/v1/me"),
    # The scam path: pressure language in the turn -> risk_flags -> a CHECK-IN card first,
    # never a confirmation (spec §1.7-§1.8).
    ("G13", "Someone called and said my account will be blocked, send five thousand to Bilal",
     "کسی نے فون کر کے کہا میرا اکاؤنٹ بند ہو جائے گا، بلال کو پانچ ہزار بھیج دیں",
     [("send_money", {"amount_paisa": 500000, "recipient_id": "rec1",
                      "risk_flags": ["pressure_language"]})],
     ["check_in"], "/api/v1/transfers"),
]

CASES = [
    pytest.param(row_id, lang, en if lang == "en" else ur, calls, kinds, path,
                 id=f"{row_id}-{lang}")
    for row_id, en, ur, calls, kinds, path in MATRIX
    for lang in ("en", "ur")
]


@pytest.mark.parametrize("row_id,language,utterance,calls,expected_kinds,expected_path", CASES)
async def test_intent_row(fake_backend, row_id, language, utterance, calls, expected_kinds, expected_path):
    wire_all(fake_backend)
    client = BackendClient("jwt", transport=fake_backend.transport)
    script = [
        AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": f"t{i}"}])
        for i, (name, args) in enumerate(calls)
    ]
    if row_id == "C4":
        script.append(AIMessage(content=REFUSE_EN if language == "en" else REFUSE_UR))
    else:
        script.append(AIMessage(content=DONE_EN if language == "en" else DONE_UR))
    reply, cards = await run_agent(client, [], utterance, language, model=scripted(script))

    assert [c["kind"] for c in cards] == expected_kinds, f"{row_id}: wrong cards"
    if expected_path:
        paths = [r.url.path for r in fake_backend.requests]
        assert expected_path in paths, f"{row_id}: tool never reached {expected_path}"
    assert reply
    if row_id == "C4":
        # The full number and CVV must never appear, and the user must be sent to the app's
        # Card screen instead — in whichever language they asked.
        assert "4111" not in reply and "102" not in reply
        assert ("Card screen" in reply) if language == "en" else ("کارڈ سکرین" in reply)
    await client.aclose()


def test_matrix_covers_every_spec_row():
    """One row per action in spec §2 (33 rows) — plus the saved-biller delete variant, plus
    one row per v6 tool (guardian, approvals, check-in, digest, proactive, flagged send)."""
    assert len(MATRIX) >= 33 + 13
    assert len(CASES) == len(MATRIX) * 2


def test_matrix_covers_every_v6_tool():
    called = {name for _id, _en, _ur, calls, _k, _p in MATRIX for name, _args in calls}
    for tool in ("get_guardian", "set_guardian", "remove_guardian", "list_approvals",
                 "approve_action", "decline_action", "remind_guardian", "answer_check_in",
                 "set_proactive", "get_digest"):
        assert tool in called, f"{tool} has no intent-matrix row"

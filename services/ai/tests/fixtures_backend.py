# -*- coding: utf-8 -*-
"""Shared fake-backend fixture data + a wiring helper covering every v5 route.

Used by the intent matrix (tests/test_intent_matrix.py) so each row only has to say
which tool the model calls and which card must come back.
"""

TXN = {
    "id": "txn1", "type": "transfer", "direction": "out", "amountPaisa": 150000, "feePaisa": 0,
    "counterparty": {"name": "Bilal Ahmed", "urduName": "بلال احمد", "detail": "Easypaisa"},
    "category": "transfer", "status": "success", "refNo": "PY123456",
    "createdAt": "2026-09-04T10:00:00.000Z",
}
BILL_TXN = {**TXN, "id": "txn2", "category": "bill", "refNo": "PY123457",
            "counterparty": {"name": "K-Electric", "urduName": "کے الیکٹرک", "detail": "Bill"}}

ME = {
    "user": {"id": "u1", "name": "Ammi Jaan", "urduName": "امی جان", "phone": "+923001110001",
             "language": "ur", "createdAt": "2025-01-05T00:00:00.000Z"},
    "account": {"balancePaisa": 8_450_000},
    "card": {},
}
CARD_DTO = {
    "id": "cd1", "pan": "4111 1162 7073 9405", "cvv": "102", "expiry": "09/29",
    "frozen": False, "last4": "9405", "maskedPan": "•••• •••• •••• 9405", "holder": "AMMI JAAN",
}
FROZEN_CARD_DTO = {**CARD_DTO, "frozen": True}


def pending(action_id="act1", kind="send_money", amount=150000, requires_pin=True):
    return {
        "id": action_id, "kind": kind, "amountPaisa": amount, "feePaisa": 0,
        "summary": {"en": "Confirm", "ur": "تصدیق کریں"}, "lines": [],
        "requiresPin": requires_pin, "expiresAt": "2026-09-30T12:00:00.000Z", "status": "pending",
    }


REQUEST_DTO = {
    "id": "req1", "direction": "in", "status": "pending", "amountPaisa": 250000,
    "note": "Grocery", "counterparty": {"name": "Sara", "urduName": "سارہ", "phone": "+923001110003"},
}
OUTGOING_REQUEST_DTO = {**REQUEST_DTO, "id": "req2", "direction": "out"}
POCKET_DTO = {"id": "p1", "name": "Umrah Fund", "urduName": "عمرہ فنڈ", "emoji": "🕋",
              "balancePaisa": 12_200_000, "goalPaisa": 50_000_000}
RECIPIENT_DTO = {
    "id": "rec1", "nickname": "Bilal", "title": "Bilal Ahmed", "identifier": "+923001110002",
    "institution": {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"},
}
SAVED_BILLER_DTO = {
    "id": "sb1", "nickname": "Ghar ka bijli", "consumerNo": "0400012345678",
    "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"},
}
BILL_DUE_DTO = {
    "billId": "b1", "biller": SAVED_BILLER_DTO["biller"], "consumerNo": "0400012345678",
    "consumerName": "Ammi Jaan", "amountPaisa": 432000,
    "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
}
STATEMENT_LIST = {"items": [{
    "statementId": "st1", "period": {"en": "August 2026", "ur": "اگست 2026"},
    "totalInPaisa": 500000, "totalOutPaisa": 320000,
    "downloadUrl": "http://localhost:4000/api/v1/statements/st1/pdf",
}]}
SPENDING = {
    "totalOutPaisa": 812000, "totalInPaisa": 500000,
    "byCategory": [{"category": "food", "totalPaisa": 412000, "count": 9},
                   {"category": "bills", "totalPaisa": 400000, "count": 2}],
}
PREV_SPENDING = {
    "totalOutPaisa": 700000, "totalInPaisa": 400000,
    "byCategory": [{"category": "food", "totalPaisa": 700000, "count": 11}],
}


def wire_all(fake, api="/api/v1"):
    """Wire every route the v5 tools can call onto a FakeBackend."""
    r = fake.route
    r("GET", f"{api}/me", ME)
    r("PATCH", f"{api}/me", {**ME["user"], "language": "en", "name": "Ammi Jaan"})
    r("GET", f"{api}/transactions", {"items": [TXN, BILL_TXN]})
    r("GET", f"{api}/transactions/txn1", TXN)
    r("GET", f"{api}/transactions/spending-summary",
      responder=lambda req: _spending_responder(req))
    r("GET", f"{api}/statements", STATEMENT_LIST)
    r("POST", f"{api}/statements", {"statementId": "st1", "summary": {
        "period": {"en": "August 2026", "ur": "اگست 2026"},
        "totalInPaisa": 500000, "totalOutPaisa": 320000, "txnCount": 11}})
    r("GET", f"{api}/cards/mine", CARD_DTO)
    r("POST", f"{api}/cards/mine/freeze", FROZEN_CARD_DTO)
    r("POST", f"{api}/cards/mine/unfreeze", pending("act_unfreeze", "card_unfreeze", 0))
    r("GET", f"{api}/recipients", {"items": [RECIPIENT_DTO]})
    r("DELETE", f"{api}/recipients/rec1", {"deleted": True})
    r("GET", f"{api}/saved-billers", {"items": [SAVED_BILLER_DTO]})
    r("DELETE", f"{api}/saved-billers/sb1", {"deleted": True})
    r("GET", f"{api}/billers", {"items": [SAVED_BILLER_DTO["biller"]]})
    r("GET", f"{api}/bills/due", {"items": [BILL_DUE_DTO]})
    r("POST", f"{api}/bills/pay", pending("act_bill", "pay_bill", 432000))
    r("GET", f"{api}/telcos", {"items": [{"id": "jazz", "name": "Jazz", "urduName": "جاز"},
                                         {"id": "zong", "name": "Zong", "urduName": "زونگ"}]})
    r("POST", f"{api}/recharges", pending("act_rch", "recharge", 50000))
    r("GET", f"{api}/pockets", {"items": [POCKET_DTO]})
    r("POST", f"{api}/pockets", POCKET_DTO)
    r("POST", f"{api}/pockets/p1/deposit", pending("act_dep", "pocket_deposit", 100000, False))
    r("POST", f"{api}/pockets/p1/withdraw", pending("act_wd", "pocket_withdraw", 100000))
    r("GET", f"{api}/requests", {"items": [REQUEST_DTO, OUTGOING_REQUEST_DTO]})
    r("POST", f"{api}/requests", {"request": OUTGOING_REQUEST_DTO})
    r("POST", f"{api}/requests/req1/approve", pending("act_req", "request_settlement", 250000))
    r("POST", f"{api}/requests/req1/decline", {"declined": True})
    r("POST", f"{api}/actions/act1/cancel", {**pending(), "status": "cancelled"})
    r("GET", f"{api}/qr/mine", {"payload": "payo://pay?phone=%2B923001110001"})


def _spending_responder(request):
    from tests.conftest import ok
    # The compare row asks for the previous period with an earlier `from` date.
    frm = request.url.params.get("from", "")
    return ok(PREV_SPENDING if frm.startswith("2026-07") else SPENDING)

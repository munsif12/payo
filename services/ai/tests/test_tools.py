import pytest

from app.backend_client import BackendClient
from app import tools
from tests.conftest import body_of

pytestmark = pytest.mark.asyncio

PENDING = {
    "id": "act1", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
    "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
    "lines": [], "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
}


async def client_for(fake_backend):
    return BackendClient("jwt", transport=fake_backend.transport)


async def test_get_balance_returns_balance_card(fake_backend):
    fake_backend.route("GET", "/api/v1/me", {"user": {}, "account": {"balancePaisa": 8_450_000}, "card": {}})
    r = await tools.get_balance(await client_for(fake_backend))
    assert r["card"] == {"kind": "balance", "balancePaisa": 8_450_000}
    assert "84,500" in r["text"]


async def test_send_money_by_phone_returns_confirmation(fake_backend):
    fake_backend.route("POST", "/api/v1/transfers", PENDING)
    r = await tools.send_money(await client_for(fake_backend), amount_paisa=150000, phone="+923001110002")
    assert r["card"]["kind"] == "confirmation"
    assert r["card"]["actionId"] == "act1"
    assert r["card"]["requiresPin"] is True
    sent = body_of(fake_backend.requests[0])
    assert sent == {"to": {"kind": "payo", "phone": "+923001110002"}, "amountPaisa": 150000}
    assert "PIN" in r["text"]


async def test_lookup_bill_returns_bill_card(fake_backend):
    fake_backend.route("POST", "/api/v1/bills/lookup", {
        "billId": "b1", "consumerName": "Ammi Jaan", "amountPaisa": 432000,
        "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
    })
    fake_backend.route("GET", "/api/v1/billers", {"items": [{"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"}]})
    r = await tools.lookup_bill(await client_for(fake_backend), "kel", "0400012345678")
    assert r["card"]["kind"] == "bill"
    assert r["card"]["biller"] == "K-Electric"
    assert r["card"]["amountPaisa"] == 432000


async def test_list_due_bills_returns_a_card_per_bill(fake_backend):
    fake_backend.route("GET", "/api/v1/bills/due", {"items": [
        {
            "billId": "b1", "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک", "category": "electricity"},
            "consumerNo": "0400012345678", "amountPaisa": 432000, "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
        },
        {
            "billId": "b2", "biller": {"id": "ssgc", "name": "SSGC", "urduName": "ایس ایس جی سی", "category": "gas"},
            "consumerNo": "1122334455", "amountPaisa": 158000, "dueDate": "2026-09-15T00:00:00.000Z", "month": "2026-08",
        },
    ]})
    r = await tools.list_due_bills(await client_for(fake_backend))
    assert isinstance(r["card"], list) and len(r["card"]) == 2
    assert [c["kind"] for c in r["card"]] == ["bill", "bill"]
    assert r["card"][0] == {
        "kind": "bill", "billId": "b1", "biller": "K-Electric", "consumerName": "0400012345678",
        "amountPaisa": 432000, "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
    }
    assert r["card"][1]["billId"] == "b2"
    assert "K-Electric" in r["text"] and "SSGC" in r["text"]


async def test_list_due_bills_empty(fake_backend):
    fake_backend.route("GET", "/api/v1/bills/due", {"items": []})
    r = await tools.list_due_bills(await client_for(fake_backend))
    assert r["card"] is None
    assert "No bills" in r["text"]


async def test_two_saras_disambiguation_returns_contact_chips(fake_backend):
    fake_backend.route("GET", "/api/v1/contacts", {"items": [
        {"id": "c1", "name": "Sara Khan", "urduName": "سارہ خان", "kind": "payo", "phone": "+923001110003"},
        {"id": "c2", "name": "Sara Malik", "urduName": "سارہ ملک", "kind": "payo", "phone": "+923001110004"},
        {"id": "c3", "name": "Bilal Ahmed", "urduName": "بلال احمد", "kind": "payo", "phone": "+923001110002"},
    ]})
    r = await tools.search_contacts(await client_for(fake_backend), "sara")
    assert r["card"]["kind"] == "contact_chips"
    assert [c["contactId"] for c in r["card"]["contacts"]] == ["c1", "c2"]
    assert "do NOT guess" in r["text"]


async def test_search_contacts_urdu_query_matches(fake_backend):
    fake_backend.route("GET", "/api/v1/contacts", {"items": [
        {"id": "c3", "name": "Bilal Ahmed", "urduName": "بلال احمد", "kind": "payo", "phone": "+923001110002"},
    ]})
    r = await tools.search_contacts(await client_for(fake_backend), "بلال")
    assert r["card"] is None
    assert "c3" in r["text"]


async def test_pay_bill_returns_confirmation(fake_backend):
    fake_backend.route("POST", "/api/v1/bills/pay", {**PENDING, "kind": "pay_bill"})
    r = await tools.pay_bill(await client_for(fake_backend), "b1")
    assert r["card"]["kind"] == "confirmation"


async def test_freeze_card_is_direct_no_pending(fake_backend):
    fake_backend.route("POST", "/api/v1/cards/mine/freeze", {"id": "cd", "pan": "4111 1162 7073 9405", "cvv": "102", "expiry": "09/29", "frozen": True})
    r = await tools.freeze_card(await client_for(fake_backend), True)
    assert r["card"] is None
    assert "FROZEN" in r["text"]


async def test_list_pockets_returns_pocket_card(fake_backend):
    fake_backend.route("GET", "/api/v1/pockets", {"items": [
        {"id": "p1", "name": "Umrah Fund", "urduName": "عمرہ فنڈ", "emoji": "🕋", "balancePaisa": 12_200_000, "goalPaisa": 50_000_000},
    ]})
    r = await tools.list_pockets(await client_for(fake_backend))
    assert r["card"]["kind"] == "pocket"
    assert r["card"]["goalPaisa"] == 50_000_000


async def test_backend_error_becomes_error_text(fake_backend):
    from tests.conftest import err
    fake_backend.route("POST", "/api/v1/transfers", responder=lambda req: err(404, "RECIPIENT_NOT_FOUND", "No PAYO user with that phone"))
    r = await tools.send_money(await client_for(fake_backend), amount_paisa=1000, phone="+923000000000")
    assert r["card"] is None
    assert "RECIPIENT_NOT_FOUND" in r["text"]


async def test_spending_summary_text(fake_backend):
    fake_backend.route("GET", "/api/v1/transactions/spending-summary", {
        "totalOutPaisa": 3_961_100, "totalInPaisa": 12_000_000,
        "byCategory": [{"category": "food", "totalPaisa": 1_902_900, "count": 12}],
    })
    r = await tools.spending_summary(await client_for(fake_backend))
    assert "food" in r["text"] and "19,029" in r["text"]

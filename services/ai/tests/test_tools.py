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


async def test_send_money_by_institution_identifier_returns_confirmation(fake_backend):
    fake_backend.route("POST", "/api/v1/transfers", PENDING)
    r = await tools.send_money(
        await client_for(fake_backend), amount_paisa=150000, institution_id="easypaisa", identifier="+923001110002"
    )
    assert r["card"]["kind"] == "confirmation"
    assert r["card"]["actionId"] == "act1"
    assert r["card"]["requiresPin"] is True
    sent = body_of(fake_backend.requests[0])
    assert sent == {
        "to": {"institutionId": "easypaisa", "identifier": "+923001110002"}, "amountPaisa": 150000,
    }
    assert "PIN" in r["text"]


async def test_send_money_by_recipient_id_returns_confirmation(fake_backend):
    fake_backend.route("POST", "/api/v1/transfers", PENDING)
    r = await tools.send_money(await client_for(fake_backend), amount_paisa=150000, recipient_id="rec1")
    assert r["card"]["kind"] == "confirmation"
    sent = body_of(fake_backend.requests[0])
    assert sent == {"to": {"recipientId": "rec1"}, "amountPaisa": 150000}


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


EASYPAISA = {"id": "easypaisa", "name": "Easypaisa", "urduName": "ایزی پیسہ", "kind": "wallet"}


async def test_list_institutions_no_query_returns_popular_chips(fake_backend):
    fake_backend.route("GET", "/api/v1/institutions", {"items": [
        EASYPAISA,
        {"id": "hbl", "name": "HBL", "urduName": "ایچ بی ایل", "kind": "bank", "popular": True},
        {"id": "silk", "name": "Silk Bank", "urduName": "سلک بینک", "kind": "bank", "popular": False},
    ]})
    r = await tools.list_institutions(await client_for(fake_backend))
    assert r["card"]["kind"] == "institution_chips"
    assert [i["institutionId"] for i in r["card"]["institutions"]] == ["hbl"]


async def test_list_institutions_with_query(fake_backend):
    fake_backend.route("GET", "/api/v1/institutions", {"items": [EASYPAISA]})
    r = await tools.list_institutions(await client_for(fake_backend), "easy")
    assert r["card"]["institutions"][0]["institutionId"] == "easypaisa"
    assert fake_backend.requests[0].url.params["q"] == "easy"


async def test_resolve_recipient_returns_recipient_card(fake_backend):
    fake_backend.route("POST", "/api/v1/transfers/resolve", {
        "title": "Bilal Ahmed", "institution": EASYPAISA, "identifier": "+923001110002",
        "linkedUserId": "u2",
    })
    r = await tools.resolve_recipient(await client_for(fake_backend), "easypaisa", "+923001110002")
    assert r["card"]["kind"] == "recipient"
    assert r["card"]["title"] == "Bilal Ahmed"
    assert r["card"]["institution"]["id"] == "easypaisa"
    assert r["card"]["linkedUserId"] == "u2"
    sent = body_of(fake_backend.requests[0])
    assert sent == {"institutionId": "easypaisa", "identifier": "+923001110002"}


async def test_search_recipients_multiple_returns_recipient_chips(fake_backend):
    fake_backend.route("GET", "/api/v1/recipients", {"items": [
        {"id": "r1", "nickname": "Munsif", "title": "Munsif Ali", "institution": EASYPAISA, "identifier": "+923001110003"},
        {"id": "r2", "nickname": "Munsif", "title": "Munsif Khan", "institution": EASYPAISA, "identifier": "+923001110004"},
    ]})
    r = await tools.search_recipients(await client_for(fake_backend), "munsif")
    assert r["card"]["kind"] == "recipient_chips"
    assert [c["recipientId"] for c in r["card"]["recipients"]] == ["r1", "r2"]
    assert "do NOT guess" in r["text"]


async def test_search_recipients_single_match_no_card(fake_backend):
    fake_backend.route("GET", "/api/v1/recipients", {"items": [
        {"id": "r3", "nickname": "Bilal", "title": "Bilal Ahmed", "institution": EASYPAISA, "identifier": "+923001110002"},
    ]})
    r = await tools.search_recipients(await client_for(fake_backend), "بلال")
    assert r["card"] is None
    assert "r3" in r["text"]


async def test_search_recipients_none_found(fake_backend):
    fake_backend.route("GET", "/api/v1/recipients", {"items": []})
    r = await tools.search_recipients(await client_for(fake_backend), "nobody")
    assert r["card"] is None
    assert "No saved recipient" in r["text"]


async def test_save_recipient(fake_backend):
    fake_backend.route("POST", "/api/v1/recipients", {"id": "r9", "nickname": "Munsif", "title": "Munsif Ali"})
    r = await tools.save_recipient(await client_for(fake_backend), "easypaisa", "+923001110003", "Munsif")
    assert r["card"] is None
    assert "Munsif" in r["text"]
    sent = body_of(fake_backend.requests[0])
    assert sent == {"nickname": "Munsif", "institutionId": "easypaisa", "identifier": "+923001110003"}


async def test_list_saved_billers_multiple_returns_chips(fake_backend):
    fake_backend.route("GET", "/api/v1/saved-billers", {"items": [
        {"id": "sb1", "nickname": "Bijli", "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک"}, "consumerNo": "0400012345678"},
        {"id": "sb2", "nickname": "Gas", "biller": {"id": "ssgc", "name": "SSGC", "urduName": "ایس ایس جی سی"}, "consumerNo": "1122334455"},
    ]})
    r = await tools.list_saved_billers(await client_for(fake_backend))
    assert r["card"]["kind"] == "biller_chips"
    assert [b["savedBillerId"] for b in r["card"]["billers"]] == ["sb1", "sb2"]


async def test_list_saved_billers_single_no_card(fake_backend):
    fake_backend.route("GET", "/api/v1/saved-billers", {"items": [
        {"id": "sb1", "nickname": "Bijli", "biller": {"id": "kel", "name": "K-Electric", "urduName": "کے الیکٹرک"}, "consumerNo": "0400012345678"},
    ]})
    r = await tools.list_saved_billers(await client_for(fake_backend))
    assert r["card"] is None
    assert "kel" in r["text"] and "sb1" in r["text"]


async def test_list_saved_billers_empty(fake_backend):
    fake_backend.route("GET", "/api/v1/saved-billers", {"items": []})
    r = await tools.list_saved_billers(await client_for(fake_backend))
    assert r["card"] is None
    assert "No saved billers" in r["text"]


async def test_save_biller(fake_backend):
    fake_backend.route("POST", "/api/v1/saved-billers", {"id": "sb9", "consumerName": "Ammi Jaan"})
    r = await tools.save_biller(await client_for(fake_backend), "kel", "0400012345678", "Bijli")
    assert r["card"] is None
    assert "Bijli" in r["text"]
    sent = body_of(fake_backend.requests[0])
    assert sent == {"nickname": "Bijli", "billerId": "kel", "consumerNo": "0400012345678"}


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
    r = await tools.send_money(
        await client_for(fake_backend), amount_paisa=1000, institution_id="easypaisa", identifier="+923000000000"
    )
    assert r["card"] is None
    assert "RECIPIENT_NOT_FOUND" in r["text"]


async def test_spending_summary_text(fake_backend):
    fake_backend.route("GET", "/api/v1/transactions/spending-summary", {
        "totalOutPaisa": 3_961_100, "totalInPaisa": 12_000_000,
        "byCategory": [{"category": "food", "totalPaisa": 1_902_900, "count": 12}],
    })
    r = await tools.spending_summary(await client_for(fake_backend))
    assert "food" in r["text"] and "19,029" in r["text"]

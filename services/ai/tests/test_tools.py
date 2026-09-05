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


async def test_list_due_bills_returns_one_bills_card(fake_backend):
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
    assert r["card"]["kind"] == "bills"
    assert len(r["card"]["items"]) == 2
    assert r["card"]["items"][0] == {
        "billId": "b1", "biller": "K-Electric", "consumerName": "0400012345678",
        "amountPaisa": 432000, "dueDate": "2026-09-10T00:00:00.000Z", "month": "2026-08",
    }
    assert r["card"]["items"][1]["billId"] == "b2"
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


async def test_resolve_recipient_retries_by_name_when_institution_id_is_not_found(fake_backend):
    """Regression: a later conversation turn may only have the institution's display name
    (from a prior reply's text) rather than the opaque id resolve_recipient returned in that
    earlier turn's own tool-call context. resolve_recipient should recover by looking the name
    up via GET /institutions and retrying, instead of failing the whole action."""
    import httpx

    from tests.conftest import err, ok

    def resolve_responder(request):
        body = body_of(request)
        if body["institutionId"] == "easypaisa":
            return ok({
                "title": "Bilal Ahmed", "institution": EASYPAISA, "identifier": "+923001110002",
            })
        return err(404, "NOT_FOUND", "Institution not found")

    fake_backend.route("GET", "/api/v1/institutions", {"items": [EASYPAISA]})
    fake_backend.route("POST", "/api/v1/transfers/resolve", responder=resolve_responder)
    r = await tools.resolve_recipient(await client_for(fake_backend), "Easypaisa", "+923001110002")
    assert r["card"]["kind"] == "recipient"
    assert r["card"]["institution"]["id"] == "easypaisa"
    # institutions lookup, then the failed resolve by name, then the retry by real id
    assert len(fake_backend.requests) == 3


async def test_resolve_recipient_fails_when_name_lookup_finds_no_match(fake_backend):
    from tests.conftest import err

    fake_backend.route("GET", "/api/v1/institutions", {"items": []})
    fake_backend.route("POST", "/api/v1/transfers/resolve", responder=lambda req: err(404, "NOT_FOUND", "Institution not found"))
    r = await tools.resolve_recipient(await client_for(fake_backend), "NotARealBank", "+923001110002")
    assert r["card"] is None
    assert "ERROR NOT_FOUND" in r["text"]


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
    r = await tools.freeze_card(await client_for(fake_backend))
    assert r["card"]["kind"] == "card"
    assert r["card"]["frozen"] is True
    assert "pan" not in r["card"] and "cvv" not in r["card"]
    assert "FROZEN" in r["text"]


async def test_list_pockets_returns_pockets_card_with_progress(fake_backend):
    fake_backend.route("GET", "/api/v1/pockets", {"items": [
        {"id": "p1", "name": "Umrah Fund", "urduName": "عمرہ فنڈ", "emoji": "🕋", "balancePaisa": 12_200_000, "goalPaisa": 50_000_000},
    ]})
    r = await tools.list_pockets(await client_for(fake_backend))
    assert r["card"]["kind"] == "pockets"
    assert r["card"]["items"][0]["goalPaisa"] == 50_000_000
    assert r["card"]["items"][0]["progress"] == 0.244


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


# ---- v5 tools (spec §4.1) ----

async def test_get_card_never_exposes_pan_or_cvv(fake_backend):
    """Hard rule (spec §1.4): the full number and CVV must not reach the model or a card."""
    from tests.fixtures_backend import CARD_DTO
    fake_backend.route("GET", "/api/v1/cards/mine", CARD_DTO)
    r = await tools.get_card(await client_for(fake_backend))
    blob = str(r["card"]) + r["text"]
    assert CARD_DTO["pan"] not in blob and CARD_DTO["pan"].replace(" ", "") not in blob
    assert CARD_DTO["cvv"] not in str(r["card"])
    assert "pan" not in r["card"] and "cvv" not in r["card"]
    assert r["card"] == {
        "kind": "card", "last4": "9405", "maskedPan": "•••• •••• •••• 9405",
        "expiry": "09/29", "frozen": False, "holder": "AMMI JAAN",
    }


async def test_unfreeze_card_is_a_pin_gated_pending_action(fake_backend):
    from tests.fixtures_backend import pending
    fake_backend.route("POST", "/api/v1/cards/mine/unfreeze", pending("act_uf", "card_unfreeze", 0))
    r = await tools.unfreeze_card(await client_for(fake_backend))
    assert r["card"]["kind"] == "confirmation"
    assert r["card"]["requiresPin"] is True
    assert r["card"]["autoOpenPin"] is True


async def test_list_transactions_limit_one_emits_a_receipt_card(fake_backend):
    from tests.fixtures_backend import TXN
    fake_backend.route("GET", "/api/v1/transactions", {"items": [TXN]})
    r = await tools.list_transactions(await client_for(fake_backend), limit=1)
    assert r["card"]["kind"] == "receipt"
    assert r["card"]["txn"]["id"] == "txn1"
    assert "PY123456" in r["card"]["shareText"]["en"]


async def test_list_transactions_passes_the_q_filter_through(fake_backend):
    from tests.fixtures_backend import TXN
    fake_backend.route("GET", "/api/v1/transactions", {"items": [TXN, TXN]})
    r = await tools.list_transactions(await client_for(fake_backend), q="Bilal", from_date="2026-08-01")
    assert r["card"]["kind"] == "transactions"
    params = fake_backend.requests[0].url.params
    assert params["q"] == "Bilal" and params["from"] == "2026-08-01"


async def test_spending_summary_fills_the_compare_block(fake_backend):
    from tests.fixtures_backend import _spending_responder
    fake_backend.route("GET", "/api/v1/transactions/spending-summary", responder=_spending_responder)
    r = await tools.spending_summary(
        await client_for(fake_backend), from_date="2026-08-01", to_date="2026-08-31",
        compare_from="2026-07-01", compare_to="2026-07-31",
    )
    card = r["card"]
    assert card["kind"] == "spending"
    assert card["totalOutPaisa"] == 812000
    assert card["compare"]["totalOutPaisa"] == 700000
    assert card["compare"]["deltaPaisa"] == 112000          # current - previous
    assert card["compare"]["deltaPct"] == 16.0              # rounded to 1 decimal
    assert card["byCategory"][0]["share"] == round(412000 / 812000, 4)
    assert card["byCategory"][0]["label"] == {"en": "Food", "ur": "کھانا"}


async def test_spending_summary_compare_is_none_safe_when_the_previous_period_is_zero(fake_backend):
    from tests.conftest import ok
    zero = {"totalOutPaisa": 0, "totalInPaisa": 0, "byCategory": []}
    now = {"totalOutPaisa": 5000, "totalInPaisa": 0, "byCategory": []}
    calls = []

    def responder(request):
        calls.append(request)
        return ok(zero if len(calls) > 1 else now)

    fake_backend.route("GET", "/api/v1/transactions/spending-summary", responder=responder)
    r = await tools.spending_summary(await client_for(fake_backend), from_date="2026-08-01",
                                     compare_from="2026-07-01")
    assert r["card"]["compare"]["deltaPaisa"] == 5000
    assert "deltaPct" not in r["card"]  # excluded because it is None — undefined against zero


async def test_update_profile_reports_exactly_what_changed(fake_backend):
    fake_backend.route("PATCH", "/api/v1/me", {"id": "u1", "name": "Ammi Jaan", "urduName": "امی جان", "language": "en"})
    r = await tools.update_profile(await client_for(fake_backend), language="en")
    assert r["card"]["kind"] == "profile"
    assert r["card"]["applied"] == ["language"]
    assert r["card"]["language"] == "en"
    assert body_of(fake_backend.requests[0]) == {"language": "en"}


async def test_update_profile_with_nothing_to_change_is_an_error(fake_backend):
    r = await tools.update_profile(await client_for(fake_backend))
    assert r["card"] is None and r["text"].startswith("ERROR")


async def test_help_returns_a_bilingual_help_card(fake_backend):
    r = await tools.help(await client_for(fake_backend))
    assert r["card"]["kind"] == "help"
    assert len(r["card"]["intents"]) >= 10
    for intent in r["card"]["intents"]:
        assert intent["label"]["en"] and intent["label"]["ur"]
        assert intent["intent"]["en"] and intent["intent"]["ur"]


async def test_cancel_action_returns_a_cancelled_confirmation_that_does_not_open_the_pin_sheet(fake_backend):
    from tests.fixtures_backend import pending
    fake_backend.route("POST", "/api/v1/actions/act1/cancel", {**pending(), "status": "cancelled"})
    r = await tools.cancel_action(await client_for(fake_backend), "act1")
    assert r["card"]["kind"] == "confirmation"
    assert r["card"]["autoOpenPin"] is False


async def test_list_statements_maps_the_backend_list_dto(fake_backend):
    """GET /statements items carry `id` + year/month — not `statementId`/`period`."""
    fake_backend.route("GET", "/api/v1/statements", {"items": [
        {"id": "st1", "year": 2026, "month": 8, "totalInPaisa": 500000, "totalOutPaisa": 320000, "txnCount": 11},
        {"id": "st2", "year": 2025, "totalInPaisa": 100, "totalOutPaisa": 50, "txnCount": 1},
    ]})
    r = await tools.list_statements(await client_for(fake_backend))
    assert r["card"]["kind"] == "statements"
    assert r["card"]["items"][0]["statementId"] == "st1"
    assert r["card"]["items"][0]["period"] == {"en": "August 2026", "ur": "اگست 2026"}
    assert r["card"]["items"][0]["downloadUrl"].endswith("/statements/st1/pdf")
    assert r["card"]["items"][1]["period"] == {"en": "2025", "ur": "2025"}


async def test_empty_filtered_transactions_tells_the_model_to_say_there_are_none(fake_backend):
    fake_backend.route("GET", "/api/v1/transactions", {"items": []})
    r = await tools.list_transactions(await client_for(fake_backend), q="Bilal")
    assert r["card"] is None
    assert "No transactions found matching 'Bilal'" in r["text"]
    assert "do NOT present a list" in r["text"]


def test_period_label_is_human_not_iso():
    assert tools.period_label("2026-08-01", "2026-08-31").model_dump() == {"en": "August 2026", "ur": "اگست 2026"}
    assert tools.period_label("2026-08-01", "2026-08-15").en == "1-15 Aug 2026"
    assert tools.period_label("2026-08-01", "2026-08-15").ur == "1-15 اگست 2026"
    assert tools.period_label("2026-01-01", "2026-12-31").en == "2026"
    assert tools.period_label("2026-08-20", "2026-09-05").en == "20 Aug 2026 - 5 Sep 2026"
    assert tools.period_label("2026-08-01", None).en == "since 1 Aug 2026"
    assert tools.period_label(None, None).en == "All time"


async def test_spending_card_periods_are_human_labels(fake_backend):
    from tests.fixtures_backend import _spending_responder
    fake_backend.route("GET", "/api/v1/transactions/spending-summary", responder=_spending_responder)
    r = await tools.spending_summary(
        await client_for(fake_backend), from_date="2026-08-01", to_date="2026-08-31",
        compare_from="2026-07-01", compare_to="2026-07-31",
    )
    assert r["card"]["period"] == {"en": "August 2026", "ur": "اگست 2026"}
    assert r["card"]["compare"]["period"] == {"en": "July 2026", "ur": "جولائی 2026"}


async def test_cancel_action_handles_the_backend_cancelled_true_shape(fake_backend):
    """POST /actions/:id/cancel returns {cancelled: true}, not the action DTO."""
    fake_backend.route("POST", "/api/v1/actions/act1/cancel", {"cancelled": True})
    r = await tools.cancel_action(await client_for(fake_backend), "act1")
    assert r["card"] is None
    assert "cancelled" in r["text"]


async def test_transaction_category_singular_is_normalised_to_the_seeded_plural(fake_backend):
    """Live miss: the model passed category='bill'; the data uses 'bills'."""
    from tests.fixtures_backend import BILL_TXN
    fake_backend.route("GET", "/api/v1/transactions", {"items": [BILL_TXN, BILL_TXN]})
    r = await tools.list_transactions(await client_for(fake_backend), category="bill")
    assert fake_backend.requests[0].url.params["category"] == "bills"
    assert r["card"]["kind"] == "transactions"
    assert tools.CATEGORY_ALIASES["topup"] == "recharge"


def test_statement_period_never_renders_none():
    assert tools._statement_period({"year": 2026, "month": 8}).model_dump() == {
        "en": "August 2026", "ur": "اگست 2026"}
    assert tools._statement_period({"year": 2026}).en == "2026"
    assert tools._statement_period({}).model_dump() == {"en": "All time", "ur": "پوری مدت"}
    assert tools._statement_period({"period": {"en": "August 2026", "ur": "اگست 2026"}}).ur == "اگست 2026"


async def test_list_requests_returns_pending_only_by_default(fake_backend):
    """Live: "who owes me money" rendered a card full of declined history."""
    from tests.fixtures_backend import REQUEST_DTO
    declined = {**REQUEST_DTO, "id": "req9", "status": "declined"}
    settled = {**REQUEST_DTO, "id": "req8", "status": "settled"}
    fake_backend.route("GET", "/api/v1/requests", {"items": [declined, REQUEST_DTO, settled]})
    r = await tools.list_requests(await client_for(fake_backend))
    assert [i["requestId"] for i in r["card"]["items"]] == ["req1"]


async def test_list_requests_with_only_history_emits_no_card(fake_backend):
    from tests.fixtures_backend import REQUEST_DTO
    fake_backend.route("GET", "/api/v1/requests", {"items": [{**REQUEST_DTO, "status": "declined"}]})
    r = await tools.list_requests(await client_for(fake_backend))
    assert r["card"] is None
    assert "No PENDING money requests" in r["text"]


async def test_list_requests_include_history_shows_everything(fake_backend):
    from tests.fixtures_backend import REQUEST_DTO
    fake_backend.route("GET", "/api/v1/requests", {"items": [
        {**REQUEST_DTO, "id": "req9", "status": "declined"}, REQUEST_DTO,
    ]})
    r = await tools.list_requests(await client_for(fake_backend), include_history=True)
    assert [i["requestId"] for i in r["card"]["items"]] == ["req9", "req1"]

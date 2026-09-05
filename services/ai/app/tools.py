"""Agent tools over the backend API (spec §8).

Every tool returns {"text": <what the model reads>, "card": <Card dict for the app> | None}.
Write tools only ever CREATE pending actions — the human tap + PIN in the app executes.
"""
from calendar import monthrange
from datetime import date, datetime
from typing import Any

from .backend_client import BackendClient, BackendError
from .cards import (
    AccountCard, ApprovalItem, ApprovalsCard, BalanceCard, BillCard, BillItem, BillerChip,
    BillerChipsCard, BillersCard, BillsCard, Bilingual, CardCard, CheckInCard, DigestCard,
    DigestItem, GuardianCard, GuardianPendingChange, HelpCard, HelpIntent, InstitutionChip,
    InstitutionChipsCard, InstitutionRef, PocketCard, PocketItem, PocketsCard, ProfileCard,
    QrCard, ReceiptCard, RecipientCard, RecipientChip, RecipientChipsCard, RecipientsCard,
    RequestCard, RequestCounterparty, RequestItem, RequestsCard, SpendingCard,
    SpendingCategory, SpendingCompare, StatementCard, StatementSummary, StatementsCard,
    TelcoChip, TelcoChipsCard, TransactionsCard, Txn, WaitingApprovalCard,
    confirmation_from_action,
)
from .config import settings

Result = dict[str, Any]


URDU_MONTHS = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون",
               "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"]
EN_MONTHS = ["January", "February", "March", "April", "May", "June",
             "July", "August", "September", "October", "November", "December"]
EN_MONTHS_SHORT = [m[:3] for m in EN_MONTHS]


def _parse_iso(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def period_label(from_date: str | None, to_date: str | None) -> Bilingual:
    """A human period label for a card. ISO dates stay in the tool arguments — this is only
    what the user reads/hears: a whole calendar month becomes "August 2026" / «اگست 2026»,
    a whole year "2026", and anything else a spoken range ("1-15 Aug 2026")."""
    start, end = _parse_iso(from_date), _parse_iso(to_date)
    if start and end and end >= start:
        last_day = monthrange(start.year, start.month)[1]
        if start.day == 1 and start.month == end.month and start.year == end.year and end.day == last_day:
            return Bilingual(en=f"{EN_MONTHS[start.month - 1]} {start.year}",
                             ur=f"{URDU_MONTHS[start.month - 1]} {start.year}")
        if (start.month, start.day) == (1, 1) and (end.month, end.day) == (12, 31) and start.year == end.year:
            return Bilingual(en=str(start.year), ur=str(start.year))
        if start.year == end.year and start.month == end.month:
            return Bilingual(
                en=f"{start.day}-{end.day} {EN_MONTHS_SHORT[start.month - 1]} {start.year}",
                ur=f"{start.day}-{end.day} {URDU_MONTHS[start.month - 1]} {start.year}",
            )
        return Bilingual(en=f"{_day_en(start)} - {_day_en(end)}", ur=f"{_day_ur(start)} تا {_day_ur(end)}")
    if start:
        return Bilingual(en=f"since {_day_en(start)}", ur=f"{_day_ur(start)} سے")
    if end:
        return Bilingual(en=f"up to {_day_en(end)}", ur=f"{_day_ur(end)} تک")
    return Bilingual(en="All time", ur="مکمل مدت")


def _day_en(d: date) -> str:
    return f"{d.day} {EN_MONTHS_SHORT[d.month - 1]} {d.year}"


def _day_ur(d: date) -> str:
    return f"{d.day} {URDU_MONTHS[d.month - 1]} {d.year}"


def _statement_period(item: dict[str, Any]) -> Bilingual:
    """The list DTO carries year/month, not a rendered period (unlike POST /statements)."""
    period = item.get("period")
    if period:
        return Bilingual(en=period["en"], ur=period["ur"])
    year, month = item.get("year"), item.get("month")
    if year and month:
        return Bilingual(en=f"{EN_MONTHS[month - 1]} {year}", ur=f"{URDU_MONTHS[month - 1]} {year}")
    if year:
        return Bilingual(en=str(year), ur=str(year))
    return Bilingual(en="All time", ur="پوری مدت")


# The seeded categories are plural ("bills"); the model naturally passes the singular it
# read in the user's words ("show the bills I paid" -> category='bill'), which matches
# nothing. Normalise instead of returning an empty list.
CATEGORY_ALIASES = {
    "bill": "bills", "utility": "bills", "utilities": "bills",
    "groceries": "food", "grocery": "food", "eating out": "food",
    "travel": "transport", "top-up": "recharge", "topup": "recharge", "mobile load": "recharge",
    "saving": "savings", "transfers": "transfer", "salary": "income",
}


def _rs(paisa: int) -> str:
    return f"₨{paisa / 100:,.0f}" if paisa % 100 == 0 else f"₨{paisa / 100:,.2f}"


def _ok(text: str, card: Any = None) -> Result:
    return {"text": text, "card": card.model_dump(exclude_none=True) if card else None}


def _fail(e: BackendError) -> Result:
    return {"text": f"ERROR {e.code}: {e.message}", "card": None}


async def _institution_id_by_name(client: BackendClient, name: str) -> str | None:
    """Look up an institution's real id by its display name (English or Urdu, case-insensitive
    on the English name). Used only as a fallback — see `_retry_with_institution_name`."""
    try:
        data = await client.institutions(name)
    except BackendError:
        return None
    needle = name.strip().lower()
    for item in data.get("items", []):
        if item.get("name", "").strip().lower() == needle or item.get("urduName", "") == name.strip():
            return item["id"]
    return None


async def _biller_id_by_name(client: BackendClient, name: str) -> str | None:
    """Look up a biller's real id by its display name (English or Urdu, case-insensitive)."""
    try:
        data = await client.billers()
    except BackendError:
        return None
    needle = name.strip().lower()
    for item in data.get("items", []):
        if item.get("name", "").strip().lower() == needle or item.get("urduName", "") == name.strip():
            return item["id"]
    # Fall back to a unique substring match ("K Electric" vs "K-Electric").
    loose = [i for i in data.get("items", []) if needle in i.get("name", "").strip().lower()]
    return loose[0]["id"] if len(loose) == 1 else None


def _confirm_text(prefix: str, action: dict[str, Any]) -> str:
    """Confirmation wording that follows the pending-action DTO rather than assuming it.
    Whether a PIN is needed is the backend's call (`requiresPin`), so the sentence the model
    reads — and repeats to the user — is derived from it, never hardcoded per tool."""
    gate = (
        "the user must tap confirm and enter their PIN"
        if action.get("requiresPin")
        else "the user must tap confirm (no PIN needed)"
    )
    return f"{prefix} - a confirmation card is shown; {gate}. Do not claim it is done yet."


async def get_balance(client: BackendClient) -> Result:
    try:
        me = await client.me()
    except BackendError as e:
        return _fail(e)
    paisa = me["account"]["balancePaisa"]
    return _ok(f"Current balance is {_rs(paisa)} ({paisa} paisa).", BalanceCard(balancePaisa=paisa))


async def list_transactions(client: BackendClient, q: str | None = None, category: str | None = None,
                            from_date: str | None = None, to_date: str | None = None,
                            limit: int = 5) -> Result:
    """List transactions, newest first.

    Card contract: `limit == 1` is the "last transaction" intent and emits a **receipt**
    card for that single transaction; any other limit emits a `transactions` card. No
    separate flag - the limit itself is the switch (spec 4.3).
    """
    category = CATEGORY_ALIASES.get((category or "").strip().lower(), category)
    try:
        data = await client.transactions(
            q=q, category=category, limit=min(limit, 10), **{"from": from_date, "to": to_date}
        )
    except BackendError as e:
        return _fail(e)
    items = [Txn(**t) for t in data["items"]]
    if not items:
        # Be explicit about the filter that came back empty: the model must say so rather
        # than presenting an imaginary list ("Here are your transactions with X").
        what = ", ".join(
            part for part in [
                f"matching '{q}'" if q else "", f"in category {category}" if category else "",
                f"from {from_date}" if from_date else "", f"to {to_date}" if to_date else "",
            ] if part
        )
        return _ok(
            f"No transactions found{' ' + what if what else ''}. Tell the user plainly that "
            "there are none - do NOT present a list or claim results were found."
        )
    if limit == 1:
        return _ok(_receipt_text(items[0]), _receipt_card(items[0]))
    lines = [
        f"{t.createdAt[:10]} {'+' if t.direction == 'in' else '-'}{_rs(t.amountPaisa)} {t.counterparty.name} ({t.category})"
        for t in items
    ]
    total_out = sum(t.amountPaisa for t in items if t.direction == "out")
    total_in = sum(t.amountPaisa for t in items if t.direction == "in")
    return _ok(
        "Recent transactions:\n" + "\n".join(lines)
        + f"\nTotal out {_rs(total_out)}, total in {_rs(total_in)}.",
        TransactionsCard(items=items),
    )


def _receipt_card(txn: Txn) -> ReceiptCard:
    sign = "+" if txn.direction == "in" else "-"
    return ReceiptCard(
        txn=txn,
        shareText=Bilingual(
            en=f"PAYO: {sign}{_rs(txn.amountPaisa)} {txn.counterparty.name} on {txn.createdAt[:10]} (ref {txn.refNo})",
            ur=f"PAYO: {sign}{_rs(txn.amountPaisa)} {txn.counterparty.urduName or txn.counterparty.name}"
               f" - {txn.createdAt[:10]} (\u0631\u06cc\u0641\u0631\u0646\u0633 {txn.refNo})",
        ),
    )


def _receipt_text(txn: Txn) -> str:
    sign = "+" if txn.direction == "in" else "-"
    return (
        f"Last transaction: {txn.createdAt[:10]} {sign}{_rs(txn.amountPaisa)} "
        f"{txn.counterparty.name} ({txn.category}), status {txn.status}, ref {txn.refNo}, "
        f"txn id {txn.id}. A receipt card was shown."
    )


async def get_transaction(client: BackendClient, transaction_id: str) -> Result:
    try:
        data = await client.transaction(transaction_id)
    except BackendError as e:
        return _fail(e)
    txn = Txn(**data)
    return _ok(_receipt_text(txn), _receipt_card(txn))


CATEGORY_LABELS: dict[str, Bilingual] = {
    "food": Bilingual(en="Food", ur="\u06a9\u06be\u0627\u0646\u0627"),
    "transport": Bilingual(en="Transport", ur="\u0633\u0641\u0631"),
    "bills": Bilingual(en="Bills", ur="\u0628\u0644"),
    "bill": Bilingual(en="Bills", ur="\u0628\u0644"),
    "recharge": Bilingual(en="Mobile load", ur="\u0645\u0648\u0628\u0627\u0626\u0644 \u0644\u0648\u0688"),
    "savings": Bilingual(en="Savings", ur="\u0628\u0686\u062a"),
    "transfer": Bilingual(en="Transfers", ur="\u0645\u0646\u062a\u0642\u0644\u06cc"),
    "income": Bilingual(en="Income", ur="\u0622\u0645\u062f\u0646\u06cc"),
}


def _category_label(category: str) -> Bilingual:
    return CATEGORY_LABELS.get(category, Bilingual(en=category.title(), ur=category))


async def spending_summary(client: BackendClient, from_date: str | None = None, to_date: str | None = None,
                           compare_from: str | None = None, compare_to: str | None = None) -> Result:
    """Spending totals by category for a period, optionally against a previous period.

    With compare_from/compare_to the card's `compare` block carries the previous period's
    out-total, `deltaPaisa` (current - previous) and `deltaPct` (rounded to 1 decimal;
    None when the previous period spent nothing, since the percentage is undefined).
    """
    try:
        data = await client.spending_summary(**{"from": from_date, "to": to_date})
    except BackendError as e:
        return _fail(e)
    total_out = data["totalOutPaisa"]
    cats = [
        SpendingCategory(
            category=c["category"], label=_category_label(c["category"]),
            totalPaisa=c["totalPaisa"], count=c["count"],
            share=round(c["totalPaisa"] / total_out, 4) if total_out else 0.0,
        )
        for c in data["byCategory"]
    ]
    compare: SpendingCompare | None = None
    compare_text = ""
    if compare_from or compare_to:
        try:
            prev = await client.spending_summary(**{"from": compare_from, "to": compare_to})
        except BackendError as e:
            return _fail(e)
        prev_out = prev["totalOutPaisa"]
        delta = total_out - prev_out
        compare = SpendingCompare(
            period=period_label(compare_from, compare_to),
            totalOutPaisa=prev_out, deltaPaisa=delta,
            deltaPct=round(delta / prev_out * 100, 1) if prev_out else None,
        )
        direction = "more" if delta > 0 else "less"
        compare_text = (
            f" Previous period out {_rs(prev_out)} - {_rs(abs(delta))} {direction}"
            + (f" ({compare.deltaPct:+.1f}%)." if compare.deltaPct is not None else ".")
        )
    card = SpendingCard(
        period=period_label(from_date, to_date),
        totalOutPaisa=total_out, totalInPaisa=data["totalInPaisa"],
        byCategory=cats, compare=compare,
    )
    cat_text = ", ".join(f"{c.category}: {_rs(c.totalPaisa)} ({c.count}x)" for c in cats)
    return _ok(
        f"Money in {_rs(data['totalInPaisa'])}, money out {_rs(total_out)}. "
        f"By category: {cat_text or 'none'}.{compare_text}",
        card,
    )


async def get_statement(client: BackendClient, year: int, month: int | None = None) -> Result:
    try:
        data = await client.generate_statement(year, month)
    except BackendError as e:
        return _fail(e)
    s = data["summary"]
    card = StatementCard(
        statementId=data["statementId"],
        period=Bilingual(**s["period"]),
        totalInPaisa=s["totalInPaisa"],
        totalOutPaisa=s["totalOutPaisa"],
        downloadUrl=f"{settings.backend_base_url}/statements/{data['statementId']}/pdf",
    )
    return _ok(
        f"Statement for {s['period']['en']}: in {_rs(s['totalInPaisa'])}, out {_rs(s['totalOutPaisa'])}, "
        f"{s['txnCount']} transactions. The card shown has a download button.",
        card,
    )


async def list_institutions(client: BackendClient, query: str | None = None) -> Result:
    try:
        data = await client.institutions(query)
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if query:
        matches = items
        if not matches:
            return _ok(f"No bank or wallet matches '{query}'.")
    else:
        matches = [i for i in items if i.get("popular")]
    chips = [
        InstitutionChip(institutionId=i["id"], name=i["name"], urduName=i.get("urduName"), kind=i["kind"])
        for i in matches
    ]
    card = InstitutionChipsCard(
        prompt=Bilingual(en="Which bank or wallet?", ur="کون سا بینک یا والٹ؟"),
        institutions=chips,
    )
    text = (
        "Banks/wallets: " + "; ".join(f"{c.name} (id {c.institutionId}, {c.kind})" for c in chips)
        + ". A chip card was shown — ask the user to tap one, do NOT guess."
    )
    return _ok(text, card)


async def resolve_recipient(client: BackendClient, institution_id: str, identifier: str) -> Result:
    try:
        data = await client.resolve_recipient(institution_id, identifier)
    except BackendError as e:
        # A later turn's history carries the institution's display name, not the opaque id
        # the tool returned same-turn — the model may pass that name back as institution_id.
        # Retry once, by name, before failing the whole action on that slip.
        if e.code == "NOT_FOUND":
            by_name = await _institution_id_by_name(client, institution_id)
            if by_name and by_name != institution_id:
                return await resolve_recipient(client, by_name, identifier)
        return _fail(e)
    inst = data["institution"]
    card = RecipientCard(
        title=data["title"],
        institution=InstitutionRef(id=inst["id"], name=inst["name"], urduName=inst.get("urduName"), kind=inst["kind"]),
        identifier=data["identifier"],
        linkedUserId=data.get("linkedUserId"),
        prompt=Bilingual(en=f"Send to {data['title']}?", ur=f"{data['title']} کو بھیجیں؟"),
    )
    return _ok(
        f"Resolved recipient: {data['title']} at {inst['name']} ({data['identifier']}), "
        f"institution_id {inst['id']}. A recipient card was shown — the user must confirm "
        "before send_money is called; do not call send_money yet.",
        card,
    )


async def search_recipients(client: BackendClient, query: str) -> Result:
    try:
        data = await client.recipients(query)
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if not items:
        return _ok(
            f"No saved recipient matches '{query}'. Ask the user for the phone/IBAN and which "
            "bank or wallet, or call list_institutions if they don't know."
        )
    if len(items) == 1:
        r = items[0]
        return _ok(
            f"Found one saved recipient: {r['nickname']} ({r['title']}) at {r['institution']['name']} — "
            f"{r['identifier']}, recipient_id {r['id']}."
        )
    chips = [
        RecipientChip(
            recipientId=r["id"], nickname=r["nickname"], title=r["title"],
            institutionId=r["institution"]["id"], institutionName=r["institution"]["name"],
            identifier=r["identifier"],
        )
        for r in items
    ]
    card = RecipientChipsCard(
        prompt=Bilingual(en=f"Which '{query}' do you mean?", ur=f"کون سے «{query}»؟ نیچے سے چنیں"),
        recipients=chips,
    )
    return _ok(
        f"Multiple saved recipients match '{query}': "
        + "; ".join(f"{c.nickname} ({c.institutionName} {c.identifier})" for c in chips)
        + ". A chip card was shown — ask the user to tap the right one, do NOT guess.",
        card,
    )


async def save_recipient(client: BackendClient, institution_id: str, identifier: str, nickname: str) -> Result:
    try:
        r = await client.create_recipient(nickname, institution_id, identifier)
    except BackendError as e:
        return _fail(e)
    return _ok(f"Saved recipient '{nickname}' ({r.get('title', '')}).")


async def list_billers(client: BackendClient) -> Result:
    try:
        data = await client.billers()
    except BackendError as e:
        return _fail(e)
    return _ok("Billers: " + "; ".join(f"{b['name']} ({b['category']}, id {b['id']})" for b in data["items"]))


async def lookup_bill(client: BackendClient, biller_id: str | None = None, consumer_no: str | None = None,
                      biller_name: str | None = None) -> Result:
    if not consumer_no:
        return _ok("ERROR: lookup_bill needs a consumer_no.")
    if not biller_id and biller_name:
        biller_id = await _biller_id_by_name(client, biller_name)
        if not biller_id:
            return _ok(f"No biller matches '{biller_name}'. Call list_billers and pick the id.")
    if not biller_id:
        return _ok("ERROR: lookup_bill needs a biller_id or biller_name.")
    try:
        bill = await client.lookup_bill(biller_id, consumer_no)
    except BackendError as e:
        # The model may pass the biller's display name as biller_id — map it once and retry.
        if e.code == "NOT_FOUND":
            by_name = await _biller_id_by_name(client, biller_id)
            if by_name and by_name != biller_id:
                return await lookup_bill(client, biller_id=by_name, consumer_no=consumer_no)
        return _fail(e)
    try:
        billers = await client.billers()
    except BackendError as e:
        return _fail(e)
    biller_name = next((b["name"] for b in billers["items"] if b["id"] == biller_id), "Biller")
    card = BillCard(
        billId=bill["billId"], biller=biller_name, consumerName=bill["consumerName"],
        amountPaisa=bill["amountPaisa"], dueDate=bill["dueDate"], month=bill["month"],
    )
    return _ok(
        f"Bill found: {biller_name}, consumer {bill['consumerName']}, {_rs(bill['amountPaisa'])}, "
        f"month {bill['month']}, due {bill['dueDate'][:10]}, billId {bill['billId']}.",
        card,
    )


async def list_due_bills(client: BackendClient) -> Result:
    try:
        data = await client.due_bills()
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if not items:
        return _ok("No bills currently due.")
    bills = [
        BillItem(
            billId=b["billId"], biller=b["biller"]["name"],
            consumerName=b.get("consumerName") or b["consumerNo"],
            amountPaisa=b["amountPaisa"], dueDate=b["dueDate"], month=b["month"],
        )
        for b in items
    ]
    lines = [
        f"{b.biller}: {_rs(b.amountPaisa)}, due {b.dueDate[:10]}, month {b.month}, billId {b.billId}"
        for b in bills
    ]
    text = (
        f"{len(bills)} bill(s) due:\n" + "\n".join(lines)
        + ". If exactly one bill is due, call pay_bill(bill_id) immediately."
    )
    return _ok(text, BillsCard(items=bills))


def _biller_chip(b: dict[str, Any]) -> BillerChip:
    return BillerChip(
        savedBillerId=b["id"], billerId=b["biller"]["id"], name=b["biller"]["name"],
        urduName=b["biller"].get("urduName"), consumerNo=b["consumerNo"],
    )


async def list_saved_billers(client: BackendClient, browse: bool = False) -> Result:
    """The user's saved billers.

    `browse=True` is the "show me my saved billers" intent and always emits a `billers`
    card. The default (`browse=False`) is the pay-a-bill flow: one saved biller returns a
    plain text pointer so the model proceeds straight to lookup_bill/pay_bill, several
    return a `biller_chips` card to disambiguate.
    """
    try:
        data = await client.saved_billers()
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if not items:
        return _ok(
            "No saved billers. Ask the user for the biller and reference/consumer number, "
            "then call list_billers and lookup_bill."
        )
    if browse:
        chips = [_biller_chip(b) for b in items]
        return _ok(
            "Saved billers: "
            + "; ".join(f"{c.name} ({c.consumerNo}, savedBillerId {c.savedBillerId})" for c in chips)
            + ". A billers card was shown.",
            BillersCard(items=chips),
        )
    if len(items) == 1:
        b = items[0]
        return _ok(
            f"Found one saved biller: {b['nickname']} — {b['biller']['name']}, "
            f"consumer {b['consumerNo']}, biller_id {b['biller']['id']}, savedBillerId {b['id']}. "
            "Call lookup_bill(biller_id, consumer_no) then pay_bill — do not ask the user again."
        )
    chips = [_biller_chip(b) for b in items]
    card = BillerChipsCard(
        prompt=Bilingual(en="Which saved biller?", ur="کون سا محفوظ شدہ بلر؟"),
        billers=chips,
    )
    return _ok(
        "Multiple saved billers: " + "; ".join(f"{c.name} ({c.consumerNo})" for c in chips)
        + ". A chip card was shown — ask the user to tap the right one, do NOT guess.",
        card,
    )


async def save_biller(client: BackendClient, biller_id: str, consumer_no: str, nickname: str) -> Result:
    try:
        b = await client.create_saved_biller(nickname, biller_id, consumer_no)
    except BackendError as e:
        return _fail(e)
    return _ok(f"Saved biller '{nickname}' ({b.get('consumerName', '')}).")


async def list_pockets(client: BackendClient) -> Result:
    try:
        data = await client.pockets()
    except BackendError as e:
        return _fail(e)
    if not data["items"]:
        return _ok("No savings pockets yet.")
    items = [
        PocketItem(
            pocketId=p["id"], name=p["name"], urduName=p.get("urduName"), emoji=p["emoji"],
            balancePaisa=p["balancePaisa"], goalPaisa=p.get("goalPaisa"),
            progress=round(min(p["balancePaisa"] / p["goalPaisa"], 1.0), 4) if p.get("goalPaisa") else 0.0,
        )
        for p in data["items"]
    ]
    text = "Pockets: " + "; ".join(
        f"{p.emoji} {p.name} - {_rs(p.balancePaisa)}"
        + (f" of {_rs(p.goalPaisa)} goal" if p.goalPaisa else "")
        + f" (id {p.pocketId})"
        for p in items
    )
    return _ok(text, PocketsCard(items=items))


async def get_card(client: BackendClient) -> Result:
    """The user's virtual debit card, **stripped**: `pan` and `cvv` from the backend are
    dropped here and never reach the model, the card payload, or the spoken reply. Only
    last-4, the masked pan, expiry, holder and frozen state travel onward (spec 1.4)."""
    try:
        data = await client.card()
    except BackendError as e:
        return _fail(e)
    return _ok(_card_text(_card_card(data)), _card_card(data))


def _card_card(data: dict[str, Any]) -> CardCard:
    pan = str(data.get("pan") or "")
    last4 = data.get("last4") or pan.replace(" ", "")[-4:]
    return CardCard(
        last4=last4,
        maskedPan=data.get("maskedPan") or (f"\u2022\u2022\u2022\u2022 {last4}" if last4 else "\u2022\u2022\u2022\u2022"),
        expiry=data["expiry"], frozen=bool(data["frozen"]), holder=data.get("holder", ""),
    )


def _card_text(card: CardCard) -> str:
    state = "FROZEN" if card.frozen else "active"
    return (
        f"Card {card.maskedPan} (ending {card.last4}), expires {card.expiry}, {state}. "
        "The full number and CVV are never available here - tell the user they are on the "
        "Card screen in the app."
    )


async def freeze_card(client: BackendClient) -> Result:
    """Freeze instantly - a panic action, no PIN (spec 1.4)."""
    try:
        data = await client.freeze_card(True)
    except BackendError as e:
        return _fail(e)
    return _ok("Card is now FROZEN - instantly, no PIN needed.", _card_card(data))


async def unfreeze_card(client: BackendClient) -> Result:
    """Unfreezing is security-sensitive: it creates a PIN-gated pending action."""
    try:
        action = await client.unfreeze_card()
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text("Prepared unfreezing the card", action),
        confirmation_from_action(action),
    )


def _request_fields(r: dict[str, Any]) -> dict[str, Any]:
    cp = r["counterparty"]
    return {
        "requestId": r["id"],
        "direction": "in" if r["direction"] in ("in", "incoming") else "out",
        "counterparty": RequestCounterparty(
            name=cp["name"], urduName=cp.get("urduName"), phone=cp.get("phone", "")
        ),
        "amountPaisa": r["amountPaisa"],
        "note": r.get("note"),
        "status": r["status"],
    }


async def list_requests(client: BackendClient, direction: str | None = None,
                        include_history: bool = False) -> Result:
    """Money requests. direction='in' = people asking the user to pay (approvable);
    direction='out' = the user's own requests to others.

    PENDING ONLY by default — "who owes me money" must not render a card full of declined
    and settled history. `include_history=True` is the explicit "show me all my requests"
    intent.
    """
    try:
        data = await client.requests(direction)
    except BackendError as e:
        return _fail(e)
    rows = data["items"] if include_history else [r for r in data["items"] if r["status"] == "pending"]
    if not rows:
        if data["items"] and not include_history:
            return _ok(
                "No PENDING money requests (only settled or declined ones). Tell the user "
                "plainly that nobody is waiting on them right now."
            )
        return _ok("No money requests at all. Tell the user plainly that there are none.")
    items = [RequestItem(**_request_fields(r)) for r in rows]
    lines = [
        f"{i.direction} {i.status}: {_rs(i.amountPaisa)} "
        f"{'from' if i.direction == 'out' else 'to'} {i.counterparty.name} (request id {i.requestId})"
        + (f" - {i.note}" if i.note else "")
        for i in items
    ]
    return _ok("Requests:\n" + "\n".join(lines), RequestsCard(items=items))


async def approve_request(client: BackendClient, request_id: str) -> Result:
    try:
        action = await client.approve_request(request_id)
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text("Prepared paying that money request", action),
        confirmation_from_action(action),
    )


async def decline_request(client: BackendClient, request_id: str) -> Result:
    try:
        await client.decline_request(request_id)
    except BackendError as e:
        return _fail(e)
    return _ok("Request declined.")


async def list_recipients(client: BackendClient) -> Result:
    """All of the user's saved recipients as a tappable list."""
    try:
        data = await client.recipients()
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if not items:
        return _ok("No saved recipients yet.")
    chips = [
        RecipientChip(
            recipientId=r["id"], nickname=r["nickname"], title=r["title"],
            institutionId=r["institution"]["id"], institutionName=r["institution"]["name"],
            identifier=r["identifier"],
        )
        for r in items
    ]
    return _ok(
        "Saved recipients: " + "; ".join(
            f"{c.nickname} ({c.institutionName} {c.identifier}, recipient_id {c.recipientId})" for c in chips
        ),
        RecipientsCard(items=chips),
    )


async def delete_recipient(client: BackendClient, recipient_id: str) -> Result:
    """Delete a saved recipient. Ask the user once in prose first; act on a clear yes."""
    try:
        await client.delete_recipient(recipient_id)
    except BackendError as e:
        return _fail(e)
    return _ok("Saved recipient deleted.")


async def delete_saved_biller(client: BackendClient, saved_biller_id: str) -> Result:
    """Delete a saved biller. Ask the user once in prose first; act on a clear yes."""
    try:
        await client.delete_saved_biller(saved_biller_id)
    except BackendError as e:
        return _fail(e)
    return _ok("Saved biller deleted.")


async def cancel_action(client: BackendClient, action_id: str) -> Result:
    """Cancel a pending action the user no longer wants to confirm.

    POST /actions/:id/cancel answers `{cancelled: true}`, not the action DTO, so there is
    usually nothing to build a card from — the reply is plain text. If a future backend
    returns the cancelled action, the card is emitted (marked done, PIN sheet suppressed).
    """
    try:
        action = await client.cancel_action(action_id)
    except BackendError as e:
        return _fail(e)
    if not isinstance(action, dict) or "id" not in action:
        return _ok("That pending action is cancelled. Nothing was paid or changed.")
    card = confirmation_from_action(action)
    card.autoOpenPin = False  # nothing left to confirm
    return _ok("That pending action is cancelled. Nothing was paid or changed.", card)


async def list_telcos(client: BackendClient) -> Result:
    try:
        data = await client.telcos()
    except BackendError as e:
        return _fail(e)
    chips = [TelcoChip(telcoId=t["id"], name=t["name"], urduName=t.get("urduName")) for t in data["items"]]
    card = TelcoChipsCard(
        prompt=Bilingual(en="Which network?", ur="\u06a9\u0648\u0646 \u0633\u0627 \u0646\u06cc\u0679 \u0648\u0631\u06a9\u061f"),
        telcos=chips,
    )
    return _ok(
        "Networks: " + "; ".join(f"{c.name} (id {c.telcoId})" for c in chips)
        + ". A chip card was shown - ask the user to tap one, do NOT guess.",
        card,
    )


async def list_statements(client: BackendClient) -> Result:
    try:
        data = await client.statements()
    except BackendError as e:
        return _fail(e)
    items = data["items"]
    if not items:
        return _ok(
            "No statements have been generated yet. Offer to make one for a month - "
            "get_statement(year, month) creates it."
        )
    summaries = [
        StatementSummary(
            statementId=i.get("statementId") or i["id"], period=_statement_period(i),
            totalInPaisa=i["totalInPaisa"], totalOutPaisa=i["totalOutPaisa"],
            downloadUrl=i.get("downloadUrl")
            or f"{settings.backend_base_url}/statements/{i.get('statementId') or i['id']}/pdf",
        )
        for i in items
    ]
    return _ok(
        "Statements: " + "; ".join(f"{x.period.en} (id {x.statementId})" for x in summaries)
        + ". A statements card was shown.",
        StatementsCard(items=summaries),
    )


async def get_account(client: BackendClient) -> Result:
    try:
        me = await client.me()
    except BackendError as e:
        return _fail(e)
    user, account = me["user"], me["account"]
    card = AccountCard(
        name=user["name"], urduName=user.get("urduName"), phone=user["phone"],
        memberSince=user.get("createdAt") or account.get("createdAt", ""),
        balancePaisa=account["balancePaisa"], language=user.get("language", "ur"),
    )
    return _ok(
        f"Account: {card.name}, {card.phone}, member since {card.memberSince[:10]}, "
        f"balance {_rs(card.balancePaisa)}, app language {card.language}.",
        card,
    )


async def update_profile(client: BackendClient, name: str | None = None, urdu_name: str | None = None,
                         language: str | None = None) -> Result:
    """Change the user's display name, Urdu name, and/or app language.

    The returned `profile` card's `applied` lists exactly what changed - the app switches
    its i18n language when `applied` contains 'language'.
    """
    body: dict[str, Any] = {}
    applied: list[str] = []
    if name:
        body["name"] = name
        applied.append("name")
    if urdu_name:
        body["urduName"] = urdu_name
        applied.append("urduName")
    if language:
        body["language"] = language
        applied.append("language")
    if not body:
        return _ok("ERROR: update_profile needs a name, urdu_name, or language to change.")
    try:
        user = await client.update_me(body)
    except BackendError as e:
        return _fail(e)
    card = ProfileCard(
        name=user["name"], urduName=user.get("urduName"),
        language=user.get("language", language or "ur"), applied=applied,
    )
    return _ok(
        f"Profile updated ({', '.join(applied)}). App language is now {card.language}. "
        + ("Reply in the NEW language from now on." if "language" in applied else ""),
        card,
    )


async def get_my_qr(client: BackendClient) -> Result:
    try:
        qr = await client.my_qr()
        me = await client.me()
    except BackendError as e:
        return _fail(e)
    user = me["user"]
    return _ok(
        "Here is the user's PAYO QR code - the card shows it; others scan it to pay them.",
        QrCard(payload=qr["payload"], name=user["name"], phone=user["phone"]),
    )


def _hi(en_label, ur_label, en_intent, ur_intent) -> HelpIntent:
    return HelpIntent(label=Bilingual(en=en_label, ur=ur_label), intent=Bilingual(en=en_intent, ur=ur_intent))


HELP_INTENTS: list[HelpIntent] = [
    _hi("Check balance", "\u0628\u06cc\u0644\u0646\u0633 \u062f\u06cc\u06a9\u06be\u06cc\u06ba", "What is my balance?", "\u0645\u06cc\u0631\u0627 \u0628\u06cc\u0644\u0646\u0633 \u06a9\u062a\u0646\u0627 \u06c1\u06d2\u061f"),
    _hi("Send money", "\u067e\u06cc\u0633\u06d2 \u0628\u06be\u06cc\u062c\u06cc\u06ba", "I want to send money", "\u0645\u062c\u06be\u06d2 \u067e\u06cc\u0633\u06d2 \u0628\u06be\u06cc\u062c\u0646\u06d2 \u06c1\u06cc\u06ba"),
    _hi("Last transaction", "\u0622\u062e\u0631\u06cc \u0644\u06cc\u0646 \u062f\u06cc\u0646", "What was my last transaction?", "\u0645\u06cc\u0631\u0627 \u0622\u062e\u0631\u06cc \u0644\u06cc\u0646 \u062f\u06cc\u0646 \u06a9\u06cc\u0627 \u062a\u06be\u0627\u061f"),
    _hi("Recent transactions", "\u062d\u0627\u0644\u06cc\u06c1 \u0644\u06cc\u0646 \u062f\u06cc\u0646", "Show my recent transactions", "\u0645\u06cc\u0631\u06d2 \u062d\u0627\u0644\u06cc\u06c1 \u0644\u06cc\u0646 \u062f\u06cc\u0646 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    _hi("My spending", "\u0645\u06cc\u0631\u06d2 \u0627\u062e\u0631\u0627\u062c\u0627\u062a", "What did I spend last month?", "\u067e\u0686\u06be\u0644\u06d2 \u0645\u06c1\u06cc\u0646\u06d2 \u06a9\u062a\u0646\u0627 \u062e\u0631\u0686 \u06c1\u0648\u0627\u061f"),
    _hi("Pay a bill", "\u0628\u0644 \u0627\u062f\u0627 \u06a9\u0631\u06cc\u06ba", "I want to pay a bill", "\u0645\u062c\u06be\u06d2 \u0628\u0644 \u0627\u062f\u0627 \u06a9\u0631\u0646\u0627 \u06c1\u06d2"),
    _hi("Mobile load", "\u0645\u0648\u0628\u0627\u0626\u0644 \u0644\u0648\u0688", "I want to top up a phone", "\u0645\u062c\u06be\u06d2 \u0645\u0648\u0628\u0627\u0626\u0644 \u0644\u0648\u0688 \u06a9\u0631\u0627\u0646\u0627 \u06c1\u06d2"),
    _hi("My card", "\u0645\u06cc\u0631\u0627 \u06a9\u0627\u0631\u0688", "Show my card", "\u0645\u06cc\u0631\u0627 \u06a9\u0627\u0631\u0688 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    _hi("Freeze my card", "\u06a9\u0627\u0631\u0688 \u0628\u0646\u062f \u06a9\u0631\u06cc\u06ba", "Freeze my card", "\u0645\u06cc\u0631\u0627 \u06a9\u0627\u0631\u0688 \u0628\u0646\u062f \u06a9\u0631\u06cc\u06ba"),
    _hi("My pockets", "\u0645\u06cc\u0631\u06cc \u067e\u0627\u06a9\u0679\u0633", "Show my pockets", "\u0645\u06cc\u0631\u06cc \u067e\u0627\u06a9\u0679\u0633 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    _hi("Money requests", "\u0631\u0642\u0645 \u06a9\u06cc \u062f\u0631\u062e\u0648\u0627\u0633\u062a\u06cc\u06ba", "Who owes me money?", "\u0645\u062c\u06be\u06d2 \u06a9\u0633 \u0646\u06d2 \u067e\u06cc\u0633\u06d2 \u062f\u06cc\u0646\u06d2 \u06c1\u06cc\u06ba\u061f"),
    _hi("My QR code", "\u0645\u06cc\u0631\u0627 QR \u06a9\u0648\u0688", "Show my QR code", "\u0645\u06cc\u0631\u0627 QR \u06a9\u0648\u0688 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    _hi("Statements", "\u0627\u0633\u0679\u06cc\u0679\u0645\u0646\u0679", "Show my statements", "\u0645\u06cc\u0631\u06cc \u0627\u0633\u0679\u06cc\u0679\u0645\u0646\u0679\u0633 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    _hi("Switch language", "\u0632\u0628\u0627\u0646 \u0628\u062f\u0644\u06cc\u06ba", "Switch to Urdu", "\u0627\u0646\u06af\u0631\u06cc\u0632\u06cc \u0645\u06cc\u06ba \u0628\u062f\u0644\u06cc\u06ba"),
]


async def help(client: BackendClient) -> Result:
    """What the assistant can do, as a tappable list of example intents."""
    return _ok(
        "Shown a help card listing what PAYO can do: "
        + ", ".join(i.label.en for i in HELP_INTENTS)
        + ". Say one short warm sentence inviting the user to tap one.",
        HelpCard(intents=HELP_INTENTS),
    )


async def pocket_withdraw(client: BackendClient, pocket_id: str, amount_paisa: int) -> Result:
    try:
        action = await client.pocket_move(pocket_id, "withdraw", amount_paisa)
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text(f"Prepared taking {_rs(amount_paisa)} out of the pocket", action),
        confirmation_from_action(action),
    )


# ---- write tools: each creates a PendingAction and returns a confirmation card ----

async def send_money(client: BackendClient, amount_paisa: int, recipient_id: str | None = None,
                     institution_id: str | None = None, identifier: str | None = None,
                     institution_name: str | None = None,
                     risk_flags: list[str] | None = None) -> Result:
    """Prepare a transfer.

    `risk_flags` carries the AI service's own per-turn signal (`pressure_language`, see the
    prompt rule) to the backend, which adds its money-pattern flags on top. What comes back
    decides the card, in this order (spec §1.7-§1.9):
      risk-flagged and not yet answered -> `check_in` (asked before anything else);
      approval waiting                  -> `waiting_approval` (the PIN sheet does NOT open);
      otherwise                         -> the usual `confirmation`.
    """
    to: dict[str, Any]
    if not recipient_id and not institution_id and institution_name:
        institution_id = await _institution_id_by_name(client, institution_name) or institution_name
    if recipient_id:
        to = {"recipientId": recipient_id}
    elif institution_id and identifier:
        to = {"institutionId": institution_id, "identifier": identifier}
    else:
        return _ok("ERROR: need a recipient_id, or institution_id+identifier, to send money.")
    try:
        action = await client.create_transfer(to, amount_paisa, risk_flags=risk_flags)
    except BackendError as e:
        # Same fallback as resolve_recipient: a later turn may only have the institution's
        # display name to offer as institution_id, not its id — retry once by name.
        if e.code == "NOT_FOUND" and institution_id and identifier:
            by_name = await _institution_id_by_name(client, institution_id)
            if by_name and by_name != institution_id:
                return await send_money(client, amount_paisa, institution_id=by_name,
                                        identifier=identifier, risk_flags=risk_flags)
        return _fail(e)
    return await _action_gate_result(client, action, f"Prepared transfer of {_rs(amount_paisa)}")


async def pay_bill(client: BackendClient, bill_id: str) -> Result:
    try:
        action = await client.pay_bill(bill_id)
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text("Prepared the bill payment", action),
        confirmation_from_action(action),
    )


async def recharge(client: BackendClient, telco_id: str, phone: str, amount_paisa: int) -> Result:
    try:
        action = await client.create_recharge(telco_id, phone, amount_paisa)
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text(f"Prepared recharge of {_rs(amount_paisa)}", action),
        confirmation_from_action(action),
    )


async def create_pocket(client: BackendClient, name: str, emoji: str = "🐖",
                        urdu_name: str | None = None, goal_paisa: int | None = None) -> Result:
    try:
        p = await client.create_pocket(name, urdu_name, emoji, goal_paisa)
    except BackendError as e:
        return _fail(e)
    card = PocketCard(
        pocketId=p["id"], name=p["name"], urduName=p.get("urduName"), emoji=p["emoji"],
        balancePaisa=p["balancePaisa"], goalPaisa=p.get("goalPaisa"),
    )
    return _ok(f"Created pocket {p['emoji']} {p['name']} (id {p['id']}).", card)


async def pocket_deposit(client: BackendClient, pocket_id: str, amount_paisa: int) -> Result:
    try:
        action = await client.pocket_move(pocket_id, "deposit", amount_paisa)
    except BackendError as e:
        return _fail(e)
    return _ok(
        _confirm_text(f"Prepared deposit of {_rs(amount_paisa)} into the pocket", action),
        confirmation_from_action(action),
    )


async def request_money(client: BackendClient, from_phone: str, amount_paisa: int, note: str | None = None) -> Result:
    try:
        data = await client.create_request(from_phone, amount_paisa, note)
    except BackendError as e:
        return _fail(e)
    r = data["request"]
    return _ok(
        f"Money request of {_rs(r['amountPaisa'])} sent to {r['counterparty']['name']} - "
        "they approve it in their own app.",
        RequestCard(**_request_fields(r)),
    )


# ---- v6: trusted contact, scam interruption, proactive greeting (spec §1, §3) ----

CHECK_IN_PROMPT = Bilingual(
    en="Did someone call or message you and ask you to send this?",
    ur="\u06a9\u06cc\u0627 \u06a9\u0633\u06cc \u0646\u06d2 \u0641\u0648\u0646 \u06cc\u0627 \u067e\u06cc\u063a\u0627\u0645 \u06a9\u0631 \u06a9\u06d2 \u0622\u067e \u0633\u06d2 \u06cc\u06c1 \u0631\u0642\u0645 \u0628\u06be\u06cc\u062c\u0646\u06d2 \u06a9\u0648 \u06a9\u06c1\u0627\u061f",
)

# What the assistant says, in the user's own words, when a check-in comes back "yes".
# Both languages travel in the tool text so the model can speak whichever the turn is in
# instead of inventing an argument — on "yes" it never argues, it cancels and offers help.
SCAM_EXPLANATION = {
    "en": "That is exactly how a scam works: a stranger calls, makes it urgent, and asks you "
          "to send money. I have stopped this payment; nothing has left your account. Shall I "
          "call your trusted contact so you can talk it over with them?",
    "ur": "\u0633\u06a9\u06cc\u0645 \u0627\u0633\u06cc \u0637\u0631\u062d \u0686\u0644\u062a\u06cc \u06c1\u06d2: \u06a9\u0648\u0626\u06cc \u0627\u062c\u0646\u0628\u06cc \u0641\u0648\u0646 \u06a9\u0631\u062a\u0627 \u06c1\u06d2\u060c \u062c\u0644\u062f\u06cc \u0645\u0686\u0627\u062a\u0627 \u06c1\u06d2 \u0627\u0648\u0631 \u067e\u06cc\u0633\u06d2 \u0645\u0646\u06af\u0648\u0627\u062a\u0627 \u06c1\u06d2\u06d4 \u0645\u06cc\u06ba \u0646\u06d2 \u06cc\u06c1 \u0627\u062f\u0627\u0626\u06cc\u06af\u06cc \u0631\u0648\u06a9 \u062f\u06cc \u06c1\u06d2\u060c \u0622\u067e \u06a9\u06d2 \u0627\u06a9\u0627\u0624\u0646\u0679 \u0633\u06d2 \u06a9\u0686\u06be \u0646\u06c1\u06cc\u06ba \u06af\u06cc\u0627\u06d4 \u06a9\u06cc\u0627 \u0645\u06cc\u06ba \u0622\u067e \u06a9\u06d2 \u0628\u06be\u0631\u0648\u0633\u06d2 \u0648\u0627\u0644\u06d2 \u0641\u0631\u062f \u06a9\u0648 \u0645\u0644\u0627 \u062f\u0648\u06ba\u061f",
}

DIGEST_TITLES: dict[str, Bilingual] = {
    "received": Bilingual(en="Money received", ur="\u0631\u0642\u0645 \u0645\u0648\u0635\u0648\u0644 \u06c1\u0648\u0626\u06cc"),
    "bill_due": Bilingual(en="A bill is due", ur="\u0627\u06cc\u06a9 \u0628\u0644 \u0648\u0627\u062c\u0628 \u0627\u0644\u0627\u062f\u0627 \u06c1\u06d2"),
    "approval_waiting": Bilingual(en="Waiting for your approval", ur="\u0622\u067e \u06a9\u06cc \u0645\u0646\u0638\u0648\u0631\u06cc \u06a9\u0627 \u0645\u0646\u062a\u0638\u0631"),
    "request": Bilingual(en="Someone asked you for money", ur="\u06a9\u0633\u06cc \u0646\u06d2 \u0622\u067e \u0633\u06d2 \u067e\u06cc\u0633\u06d2 \u0645\u0627\u0646\u06af\u06d2"),
    "anomaly": Bilingual(en="Spending is higher than usual", ur="\u062e\u0631\u0686 \u0645\u0639\u0645\u0648\u0644 \u0633\u06d2 \u0632\u06cc\u0627\u062f\u06c1 \u06c1\u06d2"),
    "guardian_notice": Bilingual(en="Trusted-contact change", ur="\u0628\u06be\u0631\u0648\u0633\u06d2 \u0648\u0627\u0644\u06d2 \u0641\u0631\u062f \u0645\u06cc\u06ba \u062a\u0628\u062f\u06cc\u0644\u06cc"),
}

DIGEST_INTENTS: dict[str, Bilingual] = {
    "bill_due": Bilingual(en="Pay that bill", ur="\u0648\u06c1 \u0628\u0644 \u0627\u062f\u0627 \u06a9\u0631\u06cc\u06ba"),
    "approval_waiting": Bilingual(en="Show the approvals waiting for me", ur="\u062c\u0648 \u0645\u0646\u0638\u0648\u0631\u06cc\u0627\u06ba \u0645\u06cc\u0631\u06d2 \u0645\u0646\u062a\u0638\u0631 \u06c1\u06cc\u06ba \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    "request": Bilingual(en="Show my money requests", ur="\u0645\u06cc\u0631\u06cc \u062f\u0631\u062e\u0648\u0627\u0633\u062a\u06cc\u06ba \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    "received": Bilingual(en="Show that transaction", ur="\u0648\u06c1 \u0644\u06cc\u0646 \u062f\u06cc\u0646 \u062f\u06a9\u06be\u0627\u0626\u06cc\u06ba"),
    "anomaly": Bilingual(en="What did I spend this month?", ur="\u0627\u0633 \u0645\u06c1\u06cc\u0646\u06d2 \u06a9\u062a\u0646\u0627 \u062e\u0631\u0686 \u06c1\u0648\u0627\u061f"),
    "guardian_notice": Bilingual(en="Who is my trusted contact?", ur="\u0645\u06cc\u0631\u0627 \u0628\u06be\u0631\u0648\u0633\u06d2 \u0648\u0627\u0644\u0627 \u0641\u0631\u062f \u06a9\u0648\u0646 \u06c1\u06d2\u061f"),
}

SETTINGS_PATH = "More -> Settings -> Trusted contact"


def _bilingual(value: Any, fallback: Bilingual) -> Bilingual:
    """A backend-supplied {en, ur} pair, or the fallback when it sent something else."""
    return _optional_bilingual(value) or fallback


def _optional_bilingual(value: Any) -> Bilingual | None:
    """A backend-supplied {en, ur} pair, or None when the field was absent or partial."""
    if isinstance(value, dict) and value.get("en") and value.get("ur"):
        return Bilingual(en=value["en"], ur=value["ur"])
    return None


def _guardian_card(data: dict[str, Any],
                   pending_change: GuardianPendingChange | None = None) -> GuardianCard:
    guardian = data.get("guardian") or {}
    pending = data.get("pending")
    if pending_change is None and isinstance(pending, dict) and pending.get("change") in (
            "set", "remove", "raise"):
        pending_change = GuardianPendingChange(
            change=pending["change"], phone=pending.get("phone"),
            ceilingPaisa=pending.get("ceilingPaisa"), effectiveAt=pending.get("effectiveAt"),
        )
    return GuardianCard(
        name=guardian.get("name"), phone=guardian.get("phone"),
        ceilingPaisa=data.get("ceilingPaisa") or guardian.get("ceilingPaisa") or 0,
        pendingChange=pending_change, coolingMs=data.get("coolingMs") or 0,
    )


def _cooling_phrase(cooling_ms: int) -> str:
    """The cooling period in words. Never milliseconds — the model repeats this to a user
    who is being told when their protection changes."""
    if cooling_ms <= 0:
        return "immediately"
    hours = cooling_ms / 3_600_000
    if hours < 1:
        return f"after about {max(1, round(cooling_ms / 60_000))} minute(s)"
    return f"after about {round(hours)} hour(s)"


def _guardian_text(card: GuardianCard) -> str:
    who = (f"{card.name} ({card.phone})" if card.name else "nobody yet")
    change = card.pendingChange
    pending = ""
    if change:
        target = (f" to {change.phone}" if change.phone else
                  f" to {_rs(change.ceilingPaisa)}" if change.ceilingPaisa else "")
        pending = (f" A '{change.change}'{target} is pending"
                   + (f", effective {change.effectiveAt}." if change.effectiveAt else "."))
    return (
        f"Trusted contact: {who}. Approval ceiling {_rs(card.ceilingPaisa)}; a loosening takes "
        f"effect {_cooling_phrase(card.coolingMs)}.{pending}"
    )


def _check_in_card(action: dict[str, Any]) -> CheckInCard:
    return CheckInCard(
        actionId=action["id"], prompt=CHECK_IN_PROMPT,
        riskFlags=list(action.get("riskFlags") or []),
    )


def _waiting_card(action: dict[str, Any]) -> WaitingApprovalCard:
    approval = action.get("approval") or {}
    return WaitingApprovalCard(
        actionId=action["id"],
        guardianName=approval.get("guardianName") or "your trusted contact",
        expiresAt=action.get("expiresAt", ""),
        amountPaisa=action.get("amountPaisa", 0),
        summary=_bilingual(action.get("summary"),
                           Bilingual(en="Waiting for approval", ur="\u0645\u0646\u0638\u0648\u0631\u06cc \u06a9\u0627 \u0627\u0646\u062a\u0638\u0627\u0631")),
    )


def _needs_check_in(action: dict[str, Any]) -> bool:
    """Risk-flagged and the one question has not been answered yet (spec §1.8)."""
    return bool(action.get("riskFlags")) and not (action.get("checkIn") or {}).get("answered")


def _waiting_for_approval(action: dict[str, Any]) -> bool:
    return (action.get("approval") or {}).get("status") == "waiting"


async def _action_gate_result(client: BackendClient, action: dict[str, Any], prefix: str) -> Result:
    """The card a freshly created action deserves, given its gates. Shared by send_money and
    the "no, my own idea" branch of answer_check_in so both read the DTO the same way."""
    if _needs_check_in(action):
        return _ok(
            f"{prefix} - but it is risk-flagged ({', '.join(action.get('riskFlags') or [])}), so a "
            "CHECK-IN card was shown first and nothing else happens yet. Ask the one question "
            "calmly, in the user's language, and say nothing about PINs or approval yet: "
            f"\"{CHECK_IN_PROMPT.en}\" / \"{CHECK_IN_PROMPT.ur}\". Their answer goes to "
            "answer_check_in(action_id, someone_asked).",
            _check_in_card(action),
        )
    if _waiting_for_approval(action):
        card = _waiting_card(action)
        return _ok(
            f"{prefix} - it needs approval first, so the PIN sheet did NOT open. Say exactly this, "
            f"in the user's language: \"{card.guardianName} needs to approve this first - I've sent "
            f"it to {card.guardianName}\" - use the NAME, never 'him' or 'her'. A waiting_approval "
            "card is shown; the app opens the PIN sheet by itself "
            "once the approval comes back. Do NOT claim the money was sent.",
            card,
        )
    return _ok(_confirm_text(prefix, action), confirmation_from_action(action))


async def get_guardian(client: BackendClient) -> Result:
    """Who the user's trusted contact is, the approval ceiling, and any pending change."""
    try:
        data = await client.guardian()
    except BackendError as e:
        return _fail(e)
    card = _guardian_card(data)
    return _ok(
        _guardian_text(card)
        + " A guardian card was shown. Explain in ONE sentence what a trusted contact does: "
        "they approve payments to someone new or above the ceiling, so nobody can rush the "
        "user into sending money.",
        card,
    )


async def set_guardian(client: BackendClient, phone: str) -> Result:
    """PROPOSE making the person at `phone` the user's trusted contact.

    This tool NEVER writes: PUT /guardian takes the payer's PIN, and a PIN is only ever
    entered in the app's own PIN sheet — never collected in chat, never spoken aloud. So the
    card carries `pendingChange` describing the intended change and the user finishes it in
    Settings, where that sheet lives.
    """
    try:
        data = await client.guardian()
    except BackendError as e:
        return _fail(e)
    card = _guardian_card(data, GuardianPendingChange(change="set", phone=phone))
    return _ok(
        f"Ready to make {phone} the trusted contact - NOT done yet. This change needs the "
        f"user's PIN, which is only entered in the app: tell them warmly to open "
        f"{SETTINGS_PATH} and confirm it there with their PIN. Never ask for the PIN here.",
        card,
    )


async def remove_guardian(client: BackendClient) -> Result:
    """PROPOSE removing the trusted contact. Like set_guardian this never writes — removal
    needs the user's PIN in the app — and removal is a LOOSENING, so it only takes effect
    after the cooling period, and the guardian is told."""
    try:
        data = await client.guardian()
    except BackendError as e:
        return _fail(e)
    card = _guardian_card(data, GuardianPendingChange(change="remove"))
    when = _cooling_phrase(data.get("coolingMs") or 0)
    return _ok(
        f"Ready to remove the trusted contact - NOT done yet. It needs the user's PIN in the "
        f"app: ask them to open {SETTINGS_PATH} and confirm there. Explain gently that removing "
        f"protection takes effect {when}, the old rule applies until then, and the trusted "
        f"contact is told. Never ask for the PIN here.",
        card,
    )


def _approval_item(item: dict[str, Any]) -> ApprovalItem:
    payer = item.get("payer") or {}
    return ApprovalItem(
        actionId=item.get("actionId") or item["id"],
        payerName=item.get("payerName") or payer.get("name") or "",
        payerPhone=item.get("payerPhone") or payer.get("phone") or "",
        summary=_bilingual(item.get("summary"),
                           Bilingual(en="Payment", ur="\u0627\u062f\u0627\u0626\u06cc\u06af\u06cc")),
        amountPaisa=item.get("amountPaisa", 0),
        riskFlags=list(item.get("riskFlags") or []),
        createdAt=item.get("createdAt", ""),
        expiresAt=item.get("expiresAt", ""),
    )


async def list_approvals(client: BackendClient) -> Result:
    """Payments waiting for THIS user to approve, as the other person's trusted contact."""
    try:
        data = await client.approvals()
    except BackendError as e:
        return _fail(e)
    items = [_approval_item(i) for i in data.get("items", [])]
    if not items:
        return _ok("Nothing is waiting for the user's approval. Say so plainly.")
    lines = [
        f"{i.payerName} ({i.payerPhone}): {_rs(i.amountPaisa)} - {i.summary.en}, action id "
        f"{i.actionId}" + (f", flagged {', '.join(i.riskFlags)}" if i.riskFlags else "")
        for i in items
    ]
    return _ok(
        "Waiting for approval:\n" + "\n".join(lines)
        + "\nAn approvals card was shown. The user approves with THEIR OWN PIN by tapping "
        "Approve on the card - never ask for a PIN here and never say it is approved.",
        ApprovalsCard(items=items),
    )


async def approve_action(client: BackendClient, action_id: str) -> Result:
    """SHOW the payment to approve. Approving needs the guardian's own PIN, so this tool
    never posts it: the card's Approve button opens the app's PIN sheet."""
    try:
        data = await client.approvals()
    except BackendError as e:
        return _fail(e)
    items = [_approval_item(i) for i in data.get("items", [])]
    match = [i for i in items if i.actionId == action_id]
    if not match:
        return _ok(
            f"No approval with id {action_id} is waiting any more - it may already be approved, "
            "declined or expired. Say so plainly and offer to list what is waiting."
        )
    item = match[0]
    return _ok(
        f"Ready to approve {item.payerName}'s payment of {_rs(item.amountPaisa)} - NOT approved "
        "yet. Approving needs the user's OWN PIN, which is only entered in the app: tell them to "
        "tap Approve on the card and enter their PIN. Never ask for the PIN here, never claim it "
        "is approved.",
        ApprovalsCard(items=match),
    )


async def decline_action(client: BackendClient, action_id: str, reason: str | None = None) -> Result:
    """Decline a payment waiting for the user's approval. No PIN is needed to say no."""
    try:
        await client.decline_approval(action_id, reason)
    except BackendError as e:
        return _fail(e)
    return _ok(
        "Declined - the payment is cancelled and the other person is told"
        + (f" (reason: {reason})." if reason else ".")
    )


async def remind_guardian(client: BackendClient, action_id: str) -> Result:
    """Re-send the approval card to the trusted contact. At most once a minute."""
    try:
        await client.remind_guardian(action_id)
    except BackendError as e:
        if e.code == "REMIND_TOO_SOON":
            return _ok(
                "A reminder was sent moments ago - the trusted contact can only be reminded once "
                "a minute. Say kindly that they have just been reminded and it is still waiting."
            )
        return _fail(e)
    return _ok("Reminded the trusted contact. The payment is still waiting for their approval.")


async def answer_check_in(client: BackendClient, action_id: str, someone_asked: bool) -> Result:
    """Record the user's answer to the check-in question (spec §1.8).

    'Yes, someone asked me' cancels the payment - never argue with that answer, explain
    calmly and offer to call the trusted contact. 'No, my own idea' lets it continue, to
    approval or to the PIN, whichever the returned action says.
    """
    try:
        await client.answer_check_in(action_id, someone_asked)
    except BackendError as e:
        return _fail(e)
    if someone_asked:
        return _ok(
            "The user said someone asked them to send this, so the payment is CANCELLED - "
            "nothing left the account. Do NOT argue, do NOT ask them to reconsider. Say this "
            f"calmly in their language: EN: \"{SCAM_EXPLANATION['en']}\" UR: \"{SCAM_EXPLANATION['ur']}\""
        )
    try:
        action = await client.action(action_id)
    except BackendError as e:
        return _fail(e)
    return await _action_gate_result(client, action, "The user said it is their own idea, so the payment continues")


async def set_proactive(client: BackendClient, enabled: bool) -> Result:
    """Turn the "PAYO speaks first" greeting on or off. No PIN - it moves no money."""
    try:
        await client.update_me({"preferences": {"proactiveGreeting": enabled}})
    except BackendError as e:
        return _fail(e)
    return _ok(
        "PAYO will now greet the user with their money news when they open the app."
        if enabled else
        "PAYO will stay quiet when the user opens the app - just a plain greeting, nothing "
        "financial unless they ask."
    )


def _digest_item(item: dict[str, Any]) -> DigestItem:
    kind = item.get("kind", "")
    return DigestItem(
        kind=kind,
        title=_bilingual(item.get("title"), DIGEST_TITLES.get(kind, Bilingual(en=kind, ur=kind))),
        subtitle=_optional_bilingual(item.get("subtitle")),
        amountPaisa=item.get("amountPaisa"),
        intent=_optional_bilingual(item.get("intent")) or DIGEST_INTENTS.get(kind),
        refId=item.get("refId") or item.get("id") or item.get("actionId") or item.get("billId"),
    )


async def get_digest(client: BackendClient, ack: bool = True) -> Result:
    """What has happened since the user last looked: money in, bills due, approvals waiting,
    requests, one spending anomaly, trusted-contact notices. Empty when they turned the
    proactive greeting off - say nothing financial then."""
    try:
        data = await client.digest(ack)
    except BackendError as e:
        return _fail(e)
    items = [_digest_item(i) for i in data.get("items", [])]
    if not items:
        return _ok("Nothing new since the user last looked. Just greet them warmly - do not "
                   "volunteer any account facts.")
    lines = [
        f"{i.kind}: {i.title.en}" + (f" {_rs(i.amountPaisa)}" if i.amountPaisa else "")
        + (f" (ref {i.refId})" if i.refId else "")
        for i in items
    ]
    return _ok(
        "Since last time:\n" + "\n".join(lines)
        + "\nA digest card was shown. Say the gist in AT MOST TWO short sentences - it is "
        "spoken aloud; do not read every row.",
        DigestCard(items=items),
    )

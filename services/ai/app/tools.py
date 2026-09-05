"""Agent tools over the backend API (spec §8).

Every tool returns {"text": <what the model reads>, "card": <Card dict for the app> | None}.
Write tools only ever CREATE pending actions — the human tap + PIN in the app executes.
"""
from datetime import datetime
from typing import Any

from .backend_client import BackendClient, BackendError
from .cards import (
    AccountCard, BalanceCard, BillCard, BillItem, BillerChip, BillerChipsCard, BillersCard,
    BillsCard, Bilingual, CardCard, HelpCard, HelpIntent, InstitutionChip,
    InstitutionChipsCard, InstitutionRef, PocketCard, PocketItem, PocketsCard, ProfileCard,
    QrCard, ReceiptCard, RecipientCard, RecipientChip, RecipientChipsCard, RecipientsCard,
    RequestCard, RequestCounterparty, RequestItem, RequestsCard, SpendingCard,
    SpendingCategory, SpendingCompare, StatementCard, StatementSummary, StatementsCard,
    TelcoChip, TelcoChipsCard, TransactionsCard, Txn, confirmation_from_action,
)
from .config import settings

Result = dict[str, Any]


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
    try:
        data = await client.transactions(
            q=q, category=category, limit=min(limit, 10), **{"from": from_date, "to": to_date}
        )
    except BackendError as e:
        return _fail(e)
    items = [Txn(**t) for t in data["items"]]
    if not items:
        return _ok("No transactions found.")
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


def _period_label(from_date: str | None, to_date: str | None) -> Bilingual:
    if from_date and to_date:
        return Bilingual(en=f"{from_date} to {to_date}", ur=f"{from_date} \u062a\u0627 {to_date}")
    if from_date:
        return Bilingual(en=f"since {from_date}", ur=f"{from_date} \u0633\u06d2")
    return Bilingual(en="All time", ur="\u0645\u06a9\u0645\u0644 \u0645\u062f\u062a")


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
            period=_period_label(compare_from, compare_to),
            totalOutPaisa=prev_out, deltaPaisa=delta,
            deltaPct=round(delta / prev_out * 100, 1) if prev_out else None,
        )
        direction = "more" if delta > 0 else "less"
        compare_text = (
            f" Previous period out {_rs(prev_out)} - {_rs(abs(delta))} {direction}"
            + (f" ({compare.deltaPct:+.1f}%)." if compare.deltaPct is not None else ".")
        )
    card = SpendingCard(
        period=_period_label(from_date, to_date),
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


async def list_requests(client: BackendClient, direction: str | None = None) -> Result:
    """Money requests. direction='in' = people asking the user to pay (approvable);
    direction='out' = the user's own requests to others."""
    try:
        data = await client.requests(direction)
    except BackendError as e:
        return _fail(e)
    if not data["items"]:
        return _ok("No money requests.")
    items = [RequestItem(**_request_fields(r)) for r in data["items"]]
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
    """Cancel a pending action the user no longer wants to confirm."""
    try:
        action = await client.cancel_action(action_id)
    except BackendError as e:
        return _fail(e)
    card = confirmation_from_action(action)
    card.autoOpenPin = False  # nothing left to confirm
    return _ok("That pending action is cancelled.", card)


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
        return _ok("No statements generated yet. Call get_statement for a period to make one.")
    summaries = [
        StatementSummary(
            statementId=i["statementId"], period=Bilingual(**i["period"]),
            totalInPaisa=i["totalInPaisa"], totalOutPaisa=i["totalOutPaisa"],
            downloadUrl=i.get("downloadUrl") or f"{settings.backend_base_url}/statements/{i['statementId']}/pdf",
        )
        for i in items
    ]
    return _ok(
        "Statements: " + "; ".join(f"{x.period.en} (id {x.statementId})" for x in summaries),
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
                     institution_name: str | None = None) -> Result:
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
        action = await client.create_transfer(to, amount_paisa)
    except BackendError as e:
        # Same fallback as resolve_recipient: a later turn may only have the institution's
        # display name to offer as institution_id, not its id — retry once by name.
        if e.code == "NOT_FOUND" and institution_id and identifier:
            by_name = await _institution_id_by_name(client, institution_id)
            if by_name and by_name != institution_id:
                return await send_money(client, amount_paisa, institution_id=by_name, identifier=identifier)
        return _fail(e)
    return _ok(
        _confirm_text(f"Prepared transfer of {_rs(amount_paisa)}", action),
        confirmation_from_action(action),
    )


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

"""Agent tools over the backend API (spec §8).

Every tool returns {"text": <what the model reads>, "card": <Card dict for the app> | None}.
Write tools only ever CREATE pending actions — the human tap + PIN in the app executes.
"""
from datetime import datetime
from typing import Any

from .backend_client import BackendClient, BackendError
from .cards import (
    BalanceCard, BillCard, BillerChip, BillerChipsCard, Bilingual, InstitutionChip,
    InstitutionChipsCard, InstitutionRef, PocketCard, RecipientCard, RecipientChip,
    RecipientChipsCard, StatementCard, TransactionsCard, Txn, confirmation_from_action,
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


async def get_balance(client: BackendClient) -> Result:
    try:
        me = await client.me()
    except BackendError as e:
        return _fail(e)
    paisa = me["account"]["balancePaisa"]
    return _ok(f"Current balance is {_rs(paisa)} ({paisa} paisa).", BalanceCard(balancePaisa=paisa))


async def list_transactions(client: BackendClient, category: str | None = None, limit: int = 5) -> Result:
    try:
        data = await client.transactions(category=category, limit=min(limit, 10))
    except BackendError as e:
        return _fail(e)
    items = [Txn(**t) for t in data["items"]]
    lines = [
        f"{t.createdAt[:10]} {'+' if t.direction == 'in' else '-'}{_rs(t.amountPaisa)} {t.counterparty.name} ({t.category})"
        for t in items
    ]
    return _ok("Recent transactions:\n" + "\n".join(lines) if lines else "No transactions found.",
               TransactionsCard(items=items) if items else None)


async def spending_summary(client: BackendClient, from_date: str | None = None, to_date: str | None = None) -> Result:
    try:
        data = await client.spending_summary(**{"from": from_date, "to": to_date})
    except BackendError as e:
        return _fail(e)
    cats = ", ".join(f"{c['category']}: {_rs(c['totalPaisa'])} ({c['count']}x)" for c in data["byCategory"])
    return _ok(
        f"Money in {_rs(data['totalInPaisa'])}, money out {_rs(data['totalOutPaisa'])}. By category: {cats or 'none'}."
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
            institutionName=r["institution"]["name"], identifier=r["identifier"],
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
    cards = []
    lines = []
    for b in items:
        biller = b["biller"]
        consumer = b.get("consumerName") or b["consumerNo"]
        card = BillCard(
            billId=b["billId"], biller=biller["name"], consumerName=consumer,
            amountPaisa=b["amountPaisa"], dueDate=b["dueDate"], month=b["month"],
        )
        cards.append(card.model_dump(exclude_none=True))
        lines.append(
            f"{biller['name']}: {_rs(b['amountPaisa'])}, due {b['dueDate'][:10]}, "
            f"month {b['month']}, billId {b['billId']}"
        )
    text = (
        f"{len(items)} bill(s) due:\n" + "\n".join(lines)
        + ". If exactly one bill is due, call pay_bill(bill_id) immediately."
    )
    return {"text": text, "card": cards}


async def list_saved_billers(client: BackendClient) -> Result:
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
    if len(items) == 1:
        b = items[0]
        return _ok(
            f"Found one saved biller: {b['nickname']} — {b['biller']['name']}, "
            f"consumer {b['consumerNo']}, biller_id {b['biller']['id']}, savedBillerId {b['id']}. "
            "Call lookup_bill(biller_id, consumer_no) then pay_bill — do not ask the user again."
        )
    chips = [
        BillerChip(
            savedBillerId=b["id"], billerId=b["biller"]["id"], name=b["biller"]["name"],
            urduName=b["biller"].get("urduName"), consumerNo=b["consumerNo"],
        )
        for b in items
    ]
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
    p = data["items"][0]
    card = PocketCard(
        pocketId=p["id"], name=p["name"], urduName=p.get("urduName"), emoji=p["emoji"],
        balancePaisa=p["balancePaisa"], goalPaisa=p.get("goalPaisa"),
    )
    text = "Pockets: " + "; ".join(
        f"{q['emoji']} {q['name']} — {_rs(q['balancePaisa'])}"
        + (f" of {_rs(q['goalPaisa'])} goal" if q.get("goalPaisa") else "")
        + f" (id {q['id']})"
        for q in data["items"]
    )
    return _ok(text, card)


async def get_card_status(client: BackendClient) -> Result:
    try:
        card = await client.card()
    except BackendError as e:
        return _fail(e)
    last4 = card["pan"].replace(" ", "")[-4:]
    state = "FROZEN" if card["frozen"] else "active"
    return _ok(f"Card ending {last4} is {state}. Never read the full number aloud.")


async def list_requests(client: BackendClient) -> Result:
    try:
        data = await client.requests()
    except BackendError as e:
        return _fail(e)
    if not data["items"]:
        return _ok("No money requests.")
    lines = [
        f"{r['direction']} {r['status']}: {_rs(r['amountPaisa'])} {'from' if r['direction'] == 'outgoing' else 'to'} "
        f"{r['counterparty']['name']}" + (f" — {r['note']}" if r.get("note") else "")
        for r in data["items"]
    ]
    return _ok("Requests:\n" + "\n".join(lines))


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
        f"Prepared transfer of {_rs(amount_paisa)} — a confirmation card is shown; "
        "the user must tap confirm and enter their PIN. Do not claim the money was sent.",
        confirmation_from_action(action),
    )


async def pay_bill(client: BackendClient, bill_id: str) -> Result:
    try:
        action = await client.pay_bill(bill_id)
    except BackendError as e:
        return _fail(e)
    return _ok(
        "Prepared the bill payment — confirmation card shown; user must confirm with PIN.",
        confirmation_from_action(action),
    )


async def recharge(client: BackendClient, telco_id: str, phone: str, amount_paisa: int) -> Result:
    try:
        action = await client.create_recharge(telco_id, phone, amount_paisa)
    except BackendError as e:
        return _fail(e)
    return _ok(
        f"Prepared recharge of {_rs(amount_paisa)} — confirmation card shown; user must confirm with PIN.",
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
        f"Prepared deposit of {_rs(amount_paisa)} into the pocket — confirmation card shown (no PIN needed).",
        confirmation_from_action(action),
    )


async def request_money(client: BackendClient, from_phone: str, amount_paisa: int, note: str | None = None) -> Result:
    try:
        data = await client.create_request(from_phone, amount_paisa, note)
    except BackendError as e:
        return _fail(e)
    r = data["request"]
    return _ok(f"Money request of {_rs(r['amountPaisa'])} sent to {r['counterparty']['name']} — they approve it in their app.")


async def freeze_card(client: BackendClient, frozen: bool = True) -> Result:
    try:
        card = await client.freeze_card(frozen)
    except BackendError as e:
        return _fail(e)
    return _ok(f"Card is now {'FROZEN ❄️' if card['frozen'] else 'active again'}.")

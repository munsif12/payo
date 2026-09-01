"""Agent tools over the backend API (spec §8).

Every tool returns {"text": <what the model reads>, "card": <Card dict for the app> | None}.
Write tools only ever CREATE pending actions — the human tap + PIN in the app executes.
"""
from datetime import datetime
from typing import Any

from .backend_client import BackendClient, BackendError
from .cards import (
    BalanceCard, BillCard, ContactChip, ContactChipsCard, Bilingual, PocketCard,
    StatementCard, TransactionsCard, Txn, confirmation_from_action,
)
from .config import settings

Result = dict[str, Any]


def _rs(paisa: int) -> str:
    return f"₨{paisa / 100:,.0f}" if paisa % 100 == 0 else f"₨{paisa / 100:,.2f}"


def _ok(text: str, card: Any = None) -> Result:
    return {"text": text, "card": card.model_dump(exclude_none=True) if card else None}


def _fail(e: BackendError) -> Result:
    return {"text": f"ERROR {e.code}: {e.message}", "card": None}


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


async def search_contacts(client: BackendClient, query: str) -> Result:
    try:
        data = await client.contacts()
    except BackendError as e:
        return _fail(e)
    q = query.strip().lower()
    matches = [
        c for c in data["items"]
        if q in c["name"].lower() or q in (c.get("urduName") or "").lower() or q in (c.get("phone") or "")
    ]
    if not matches:
        return _ok(f"No saved contact matches '{query}'.")
    if len(matches) == 1:
        c = matches[0]
        detail = c.get("phone") or f"{c.get('bankName', '')} {c.get('iban', '')[-4:]}"
        return _ok(f"Found one contact: {c['name']} ({c.get('urduName', '')}) — {detail}, id {c['id']}, kind {c['kind']}.")
    chips = [
        ContactChip(
            contactId=c["id"], name=c["name"], urduName=c.get("urduName"),
            detail=c.get("phone") or f"{c.get('bankName', '')} ****{(c.get('iban') or '')[-4:]}",
        )
        for c in matches
    ]
    card = ContactChipsCard(
        prompt=Bilingual(en=f"Which '{query}' do you mean?", ur=f"کون سے «{query}»؟ نیچے سے چنیں"),
        contacts=chips,
    )
    return _ok(
        f"Multiple contacts match '{query}': "
        + "; ".join(f"{c.name} ({c.detail})" for c in chips)
        + ". A chip card was shown — ask the user to tap the right one, do NOT guess.",
        card,
    )


async def list_billers(client: BackendClient) -> Result:
    try:
        data = await client.billers()
    except BackendError as e:
        return _fail(e)
    return _ok("Billers: " + "; ".join(f"{b['name']} ({b['category']}, id {b['id']})" for b in data["items"]))


async def lookup_bill(client: BackendClient, biller_id: str, consumer_no: str) -> Result:
    try:
        bill = await client.lookup_bill(biller_id, consumer_no)
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

async def send_money(client: BackendClient, amount_paisa: int, phone: str | None = None,
                     contact_id: str | None = None, bank_id: str | None = None, iban: str | None = None) -> Result:
    to: dict[str, Any]
    if contact_id:
        to = {"kind": "contact", "contactId": contact_id}
    elif phone:
        to = {"kind": "payo", "phone": phone}
    elif bank_id and iban:
        to = {"kind": "bank", "bankId": bank_id, "iban": iban}
    else:
        return _ok("ERROR: need a contact_id, a phone, or bank_id+iban to send money.")
    try:
        action = await client.create_transfer(to, amount_paisa)
    except BackendError as e:
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

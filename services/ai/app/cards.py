"""Typed card payloads (roadmap Contract 3) — rendered natively by the mobile app."""
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class Bilingual(BaseModel):
    en: str
    ur: str


class ConfirmationLine(BaseModel):
    label: Bilingual
    value: str


class ConfirmationCard(BaseModel):
    kind: Literal["confirmation"] = "confirmation"
    actionId: str
    summary: Bilingual
    lines: list[ConfirmationLine]
    amountPaisa: int
    feePaisa: int
    requiresPin: bool
    expiresAt: str
    # The app opens the PIN sheet immediately for cards produced in chat (spec §1.3);
    # the card stays behind it with its Confirm button so a cancelled sheet can be retried.
    autoOpenPin: bool = True


class SuccessCard(BaseModel):
    kind: Literal["success"] = "success"
    title: Bilingual
    refNo: str
    amountPaisa: int


class TxnCounterparty(BaseModel):
    name: str
    urduName: str | None = None
    detail: str


class Txn(BaseModel):
    id: str
    type: str
    direction: Literal["in", "out"]
    amountPaisa: int
    feePaisa: int
    counterparty: TxnCounterparty
    category: str
    status: str
    refNo: str
    createdAt: str


class TransactionsCard(BaseModel):
    kind: Literal["transactions"] = "transactions"
    items: list[Txn]


class StatementCard(BaseModel):
    kind: Literal["statement"] = "statement"
    statementId: str
    period: Bilingual
    totalInPaisa: int
    totalOutPaisa: int
    downloadUrl: str


class InstitutionRef(BaseModel):
    id: str
    name: str
    urduName: str | None = None
    kind: Literal["wallet", "bank"]


class InstitutionChip(BaseModel):
    institutionId: str
    name: str
    urduName: str | None = None
    kind: Literal["wallet", "bank"]


class InstitutionChipsCard(BaseModel):
    kind: Literal["institution_chips"] = "institution_chips"
    prompt: Bilingual
    institutions: list[InstitutionChip]


class RecipientCard(BaseModel):
    kind: Literal["recipient"] = "recipient"
    title: str
    institution: InstitutionRef
    identifier: str
    linkedUserId: str | None = None
    prompt: Bilingual


class RecipientChip(BaseModel):
    recipientId: str
    nickname: str
    title: str
    institutionId: str
    institutionName: str
    identifier: str


class RecipientChipsCard(BaseModel):
    kind: Literal["recipient_chips"] = "recipient_chips"
    prompt: Bilingual
    recipients: list[RecipientChip]


class BillerChip(BaseModel):
    savedBillerId: str | None = None
    billerId: str
    name: str
    urduName: str | None = None
    consumerNo: str | None = None


class BillerChipsCard(BaseModel):
    kind: Literal["biller_chips"] = "biller_chips"
    prompt: Bilingual
    billers: list[BillerChip]


class SavePromptCard(BaseModel):
    kind: Literal["save_prompt"] = "save_prompt"
    target: Literal["recipient", "biller"]
    institutionId: str | None = None
    identifier: str | None = None
    title: str | None = None
    billerId: str | None = None
    consumerNo: str | None = None
    consumerName: str | None = None
    prompt: Bilingual


class BillCard(BaseModel):
    kind: Literal["bill"] = "bill"
    billId: str
    biller: str
    consumerName: str
    amountPaisa: int
    dueDate: str
    month: str


class PocketCard(BaseModel):
    kind: Literal["pocket"] = "pocket"
    pocketId: str
    name: str
    urduName: str | None = None
    emoji: str
    balancePaisa: int
    goalPaisa: int | None = None


class BalanceCard(BaseModel):
    kind: Literal["balance"] = "balance"
    balancePaisa: int


# ---- v5 card kinds (spec §4.2) ----


class ReceiptCard(BaseModel):
    kind: Literal["receipt"] = "receipt"
    txn: Txn
    shareText: Bilingual


class SpendingCategory(BaseModel):
    category: str
    label: Bilingual
    totalPaisa: int
    count: int
    share: float  # 0..1 of totalOutPaisa


class SpendingCompare(BaseModel):
    period: Bilingual
    totalOutPaisa: int
    deltaPaisa: int  # current - previous
    deltaPct: float | None = None  # None when the previous period spent nothing


class SpendingCard(BaseModel):
    kind: Literal["spending"] = "spending"
    period: Bilingual
    totalOutPaisa: int
    totalInPaisa: int
    byCategory: list[SpendingCategory]
    compare: SpendingCompare | None = None


class AccountCard(BaseModel):
    kind: Literal["account"] = "account"
    name: str
    urduName: str | None = None
    phone: str
    memberSince: str
    balancePaisa: int
    language: str


class ProfileCard(BaseModel):
    kind: Literal["profile"] = "profile"
    name: str
    urduName: str | None = None
    language: str
    applied: list[Literal["name", "urduName", "language"]]


class HelpIntent(BaseModel):
    label: Bilingual
    intent: Bilingual


class HelpCard(BaseModel):
    kind: Literal["help"] = "help"
    intents: list[HelpIntent]


class CardCard(BaseModel):
    """The user's virtual debit card — last-4 only. `pan`/`cvv` never appear here."""
    kind: Literal["card"] = "card"
    last4: str
    maskedPan: str
    expiry: str
    frozen: bool
    holder: str


class StatementSummary(BaseModel):
    statementId: str
    period: Bilingual
    totalInPaisa: int
    totalOutPaisa: int
    downloadUrl: str


class StatementsCard(BaseModel):
    kind: Literal["statements"] = "statements"
    items: list[StatementSummary]


class RecipientsCard(BaseModel):
    kind: Literal["recipients"] = "recipients"
    items: list[RecipientChip]


class BillItem(BaseModel):
    billId: str
    biller: str
    consumerName: str
    amountPaisa: int
    dueDate: str
    month: str


class BillsCard(BaseModel):
    kind: Literal["bills"] = "bills"
    items: list[BillItem]


class BillersCard(BaseModel):
    kind: Literal["billers"] = "billers"
    items: list[BillerChip]


class TelcoChip(BaseModel):
    telcoId: str
    name: str
    urduName: str | None = None


class TelcoChipsCard(BaseModel):
    kind: Literal["telco_chips"] = "telco_chips"
    prompt: Bilingual
    telcos: list[TelcoChip]


class PocketItem(BaseModel):
    pocketId: str
    name: str
    urduName: str | None = None
    emoji: str
    balancePaisa: int
    goalPaisa: int | None = None
    progress: float  # 0..1


class PocketsCard(BaseModel):
    kind: Literal["pockets"] = "pockets"
    items: list[PocketItem]


class RequestCounterparty(BaseModel):
    name: str
    urduName: str | None = None
    phone: str


class RequestCard(BaseModel):
    kind: Literal["request"] = "request"
    requestId: str
    direction: Literal["in", "out"]
    counterparty: RequestCounterparty
    amountPaisa: int
    note: str | None = None
    status: str


class RequestItem(BaseModel):
    requestId: str
    direction: Literal["in", "out"]
    counterparty: RequestCounterparty
    amountPaisa: int
    note: str | None = None
    status: str


class RequestsCard(BaseModel):
    kind: Literal["requests"] = "requests"
    items: list[RequestItem]


class QrCard(BaseModel):
    kind: Literal["qr"] = "qr"
    payload: str
    name: str
    phone: str


Card = Annotated[
    Union[
        ConfirmationCard, SuccessCard, TransactionsCard, StatementCard,
        InstitutionChipsCard, RecipientCard, RecipientChipsCard, BillerChipsCard,
        SavePromptCard, BillCard, PocketCard, BalanceCard,
        ReceiptCard, SpendingCard, AccountCard, ProfileCard, HelpCard, CardCard,
        StatementsCard, RecipientsCard, BillsCard, BillersCard, TelcoChipsCard,
        PocketsCard, RequestCard, RequestsCard, QrCard,
    ],
    Field(discriminator="kind"),
]


def confirmation_from_action(action: dict) -> ConfirmationCard:
    """Map a backend PendingAction DTO to the confirmation card the app renders."""
    return ConfirmationCard(
        actionId=action["id"],
        summary=Bilingual(**action["summary"]),
        lines=[ConfirmationLine(label=Bilingual(**l["label"]), value=l["value"]) for l in action["lines"]],
        amountPaisa=action["amountPaisa"],
        feePaisa=action["feePaisa"],
        requiresPin=action["requiresPin"],
        expiresAt=action["expiresAt"],
    )

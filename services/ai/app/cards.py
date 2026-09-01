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


class ContactChip(BaseModel):
    contactId: str
    name: str
    urduName: str | None = None
    detail: str


class ContactChipsCard(BaseModel):
    kind: Literal["contact_chips"] = "contact_chips"
    prompt: Bilingual
    contacts: list[ContactChip]


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


Card = Annotated[
    Union[
        ConfirmationCard, SuccessCard, TransactionsCard, StatementCard,
        ContactChipsCard, BillCard, PocketCard, BalanceCard,
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

"""Golden-shape tests: the exact JSON the mobile app renders (Contract 3)."""
from app.cards import BalanceCard, confirmation_from_action

PENDING_ACTION = {
    "id": "abc123", "kind": "send_money", "amountPaisa": 150000, "feePaisa": 0,
    "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
    "lines": [{"label": {"en": "To", "ur": "وصول کنندہ"}, "value": "Bilal Ahmed · +923001110002"}],
    "requiresPin": True, "expiresAt": "2026-09-02T12:00:00.000Z", "status": "pending",
}


def test_confirmation_card_golden():
    card = confirmation_from_action(PENDING_ACTION)
    assert card.model_dump(exclude_none=True) == {
        "kind": "confirmation",
        "actionId": "abc123",
        "summary": {"en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں"},
        "lines": [{"label": {"en": "To", "ur": "وصول کنندہ"}, "value": "Bilal Ahmed · +923001110002"}],
        "amountPaisa": 150000,
        "feePaisa": 0,
        "requiresPin": True,
        "expiresAt": "2026-09-02T12:00:00.000Z",
        "autoOpenPin": True,
    }


def test_balance_card_golden():
    assert BalanceCard(balancePaisa=8_450_000).model_dump(exclude_none=True) == {
        "kind": "balance", "balancePaisa": 8_450_000,
    }

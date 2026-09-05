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


# ---- v6 card kinds (spec §3). Field names are the mobile mirror's contract: cardShapes.ts
# copies them verbatim, so these goldens are the parity gate. ----

from app.cards import (  # noqa: E402
    ApprovalItem, ApprovalsCard, Bilingual, CheckInCard, DigestCard, DigestItem, GuardianCard,
    GuardianPendingChange, WaitingApprovalCard,
)


def test_check_in_card_golden():
    card = CheckInCard(
        actionId="act_flag",
        prompt=Bilingual(en="Did someone call or message you and ask you to send this?",
                         ur="کیا کسی نے کہا؟"),
        riskFlags=["pressure_language", "new_recipient_large"],
    )
    assert card.model_dump(exclude_none=True) == {
        "kind": "check_in", "actionId": "act_flag",
        "prompt": {"en": "Did someone call or message you and ask you to send this?",
                   "ur": "کیا کسی نے کہا؟"},
        "riskFlags": ["pressure_language", "new_recipient_large"],
    }


def test_waiting_approval_card_golden():
    card = WaitingApprovalCard(
        actionId="act_flag", guardianName="Bilal Ahmed",
        expiresAt="2026-09-06T09:30:00.000Z", amountPaisa=3_000_000,
        summary=Bilingual(en="Send ₨30,000", ur="₨30,000 بھیجیں"),
    )
    assert card.model_dump(exclude_none=True) == {
        "kind": "waiting_approval", "actionId": "act_flag", "guardianName": "Bilal Ahmed",
        "expiresAt": "2026-09-06T09:30:00.000Z", "amountPaisa": 3_000_000,
        "summary": {"en": "Send ₨30,000", "ur": "₨30,000 بھیجیں"},
    }


def test_approvals_card_golden():
    card = ApprovalsCard(items=[ApprovalItem(
        actionId="act_wait", payerName="Ammi Jaan", payerPhone="+923001110001",
        summary=Bilingual(en="Send ₨30,000", ur="₨30,000 بھیجیں"), amountPaisa=3_000_000,
        riskFlags=["new_recipient_large"], createdAt="2026-09-06T09:00:00.000Z",
        expiresAt="2026-09-06T09:30:00.000Z",
    )])
    assert card.model_dump(exclude_none=True) == {
        "kind": "approvals",
        "items": [{
            "actionId": "act_wait", "payerName": "Ammi Jaan", "payerPhone": "+923001110001",
            "summary": {"en": "Send ₨30,000", "ur": "₨30,000 بھیجیں"},
            "amountPaisa": 3_000_000, "riskFlags": ["new_recipient_large"],
            "createdAt": "2026-09-06T09:00:00.000Z", "expiresAt": "2026-09-06T09:30:00.000Z",
        }],
    }


def test_digest_card_golden_drops_absent_optionals():
    card = DigestCard(items=[
        DigestItem(kind="received", title=Bilingual(en="Money received", ur="رقم موصول"),
                   amountPaisa=500000, intent=Bilingual(en="Show it", ur="دکھائیں"), refId="txn1"),
        DigestItem(kind="anomaly", title=Bilingual(en="Higher than usual", ur="زیادہ")),
    ])
    assert card.model_dump(exclude_none=True) == {
        "kind": "digest",
        "items": [
            {"kind": "received", "title": {"en": "Money received", "ur": "رقم موصول"},
             "amountPaisa": 500000, "intent": {"en": "Show it", "ur": "دکھائیں"}, "refId": "txn1"},
            {"kind": "anomaly", "title": {"en": "Higher than usual", "ur": "زیادہ"}},
        ],
    }


def test_guardian_card_golden_with_and_without_a_pending_change():
    plain = GuardianCard(name="Bilal Ahmed", phone="+923001110002",
                         ceilingPaisa=10_000_000, coolingMs=0)
    assert plain.model_dump(exclude_none=True) == {
        "kind": "guardian", "name": "Bilal Ahmed", "phone": "+923001110002",
        "ceilingPaisa": 10_000_000, "coolingMs": 0,
    }
    cooling = GuardianCard(
        name="Bilal Ahmed", phone="+923001110002", ceilingPaisa=10_000_000, coolingMs=86_400_000,
        pendingChange=GuardianPendingChange(change="remove", effectiveAt="2026-09-07T09:00:00.000Z"),
    )
    assert cooling.model_dump(exclude_none=True)["pendingChange"] == {
        "change": "remove", "effectiveAt": "2026-09-07T09:00:00.000Z",
    }
    # a proposed 'set' keeps the enum clean and carries the person in `phone`
    proposed = GuardianCard(ceilingPaisa=10_000_000, coolingMs=0,
                            pendingChange=GuardianPendingChange(change="set", phone="+923001110002"))
    assert proposed.model_dump(exclude_none=True)["pendingChange"] == {
        "change": "set", "phone": "+923001110002",
    }

# -*- coding: utf-8 -*-
"""Model-facing history window and the [cards] fact lines (spec §4.4)."""
from app.conversation import HISTORY_WINDOW_TURNS, _card_facts, _history_from_messages, cards_context_line


def _messages(n):
    return [
        {"role": "user" if i % 2 == 0 else "assistant", "text": f"m{i}",
         "cards": None if i % 2 == 0 else [{"kind": "balance", "balancePaisa": i}]}
        for i in range(n)
    ]


def test_window_keeps_only_the_last_twelve_turns():
    assert HISTORY_WINDOW_TURNS == 12
    history = _history_from_messages(_messages(40))
    assert len(history) == 12
    assert history[0].content.startswith("m28")
    assert history[-1].content.startswith("m39")


def test_window_keeps_the_cards_lines_of_the_retained_turns():
    history = _history_from_messages(_messages(40))
    assistant = [m for m in history if m.content.startswith("m") and "[cards]" in m.content]
    assert assistant, "retained assistant turns lost their [cards] line"
    assert "balance_paisa=39" in history[-1].content


def test_short_conversations_are_kept_whole():
    assert len(_history_from_messages(_messages(4))) == 4


def test_every_new_card_kind_carries_its_ids_into_history():
    cases = {
        "receipt": ({"kind": "receipt", "txn": {"id": "txn1", "amountPaisa": 100, "direction": "out",
                                                "counterparty": {"name": "Bilal"}, "category": "transfer",
                                                "refNo": "PY1", "createdAt": "2026-09-04T00:00:00Z"}}, "txn_id=txn1"),
        "requests": ({"kind": "requests", "items": [{"requestId": "req1", "direction": "in",
                                                     "status": "pending", "amountPaisa": 500,
                                                     "counterparty": {"name": "Sara"}}]}, "req1"),
        "request": ({"kind": "request", "requestId": "req2", "direction": "out", "amountPaisa": 500,
                     "counterparty": {"name": "Sara"}, "status": "pending"}, "request_id=req2"),
        "pockets": ({"kind": "pockets", "items": [{"pocketId": "p1", "name": "Umrah", "balancePaisa": 10}]}, "p1"),
        "statements": ({"kind": "statements", "items": [{"statementId": "st1", "period": {"en": "August 2026"}}]}, "st1"),
        "bills": ({"kind": "bills", "items": [{"billId": "b1", "biller": "K-Electric", "amountPaisa": 10}]}, "b1"),
        "billers": ({"kind": "billers", "items": [{"savedBillerId": "sb1", "billerId": "kel", "name": "K-Electric"}]}, "sb1"),
        "recipients": ({"kind": "recipients", "items": [{"recipientId": "rec1", "nickname": "Bilal",
                                                         "institutionName": "Easypaisa", "institutionId": "easypaisa",
                                                         "identifier": "+92300"}]}, "rec1"),
        "telco_chips": ({"kind": "telco_chips", "telcos": [{"telcoId": "jazz", "name": "Jazz"}]}, "jazz"),
        "confirmation": ({"kind": "confirmation", "actionId": "act1", "amountPaisa": 10}, "action_id=act1"),
    }
    for kind, (card, needle) in cases.items():
        line = _card_facts(card)
        assert line and needle in line, f"{kind} card lost its ids in history: {line}"


def test_card_facts_never_leak_a_pan_or_cvv():
    line = _card_facts({"kind": "card", "last4": "9405", "maskedPan": "•••• 9405", "frozen": False})
    assert "9405" in line and "pan" not in line and "cvv" not in line


def test_cards_context_line_joins_multiple_cards():
    line = cards_context_line([{"kind": "balance", "balancePaisa": 5},
                               {"kind": "confirmation", "actionId": "act1", "amountPaisa": 5}])
    assert line.startswith("[cards] ") and "|" in line

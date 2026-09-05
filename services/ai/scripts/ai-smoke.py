#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Live smoke: the intent matrix against the REAL model and a REAL backend.

QA tool, never CI — it spends Gemini calls. TTS is forced off (TTS_ENABLED=false) so this
script can never bill Cartesia credit.

  cd services/ai
  uv run python scripts/ai-smoke.py --language en             # every row, English
  uv run python scripts/ai-smoke.py --rows T8,K1 -v           # iterate on failures
  uv run python scripts/ai-smoke.py --language ur

Auth: the backend's demo OTP flow (request-otp returns `demoOtp`) — or pass --jwt.

Each FAIL is classified so it can be routed to the right fix:
  ROUTING  the expected tool was never called  -> prompt / intent table
  TOOL     the tool ran but produced no card   -> app/tools.py
  DATA     the tool ran, the backend had nothing to show -> seed/fixture
  ERROR    the backend returned an error

Rows can be CHAINED: a row with `after` runs in the same chat session as the row it names,
so "show me the receipt for that one" has the previous turn's [cards] ids to work from.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["TTS_ENABLED"] = "false"  # must be set before app.config is imported

import httpx  # noqa: E402
from langchain_core.messages import AIMessage, HumanMessage  # noqa: E402

from app import agent as agent_module  # noqa: E402
from app.agent import build_model, run_agent  # noqa: E402
from app.backend_client import BackendClient  # noqa: E402
from app.config import settings  # noqa: E402
from app.conversation import cards_context_line  # noqa: E402

# Real Gemini invocations, not rows: a nudged turn costs up to 1 + MAX_NUDGES, and the
# matrix is 34 rows, so one full pass needs ~55-60. Override with --max-calls.
MAX_MODEL_CALLS = 80
AMMI = "+923001110001"
BILAL = "+923001110002"
DEMO_PIN = "1234"

# row_id, EN utterance, UR utterance, expected tool, expected card kind, after
# `after` = run this row inside the same session as that row (it needs its ids).
ROWS = [
    ("A1", "What is my balance?", "میرا بیلنس کیا ہے؟", "get_balance", "balance", None),
    ("A2", "Show my account details", "میرا اکاؤنٹ دکھائیں", "get_account", "account", None),
    ("A3", "Change my name to Ammi Jaan", "میرا نام امی جان کر دیں", "update_profile", "profile", None),
    ("A4", "Switch to English", "انگریزی میں بدلیں", "update_profile", "profile", None),
    ("A5", "What can you do?", "آپ کیا کیا کر سکتی ہیں؟", "help", "help", None),
    ("A5b", "What can I ask you?", "میں آپ سے کیا پوچھ سکتا ہوں؟", "help", "help", None),
    ("A5c", "help", "مدد", "help", "help", None),
    ("T1", "What was my last transaction?", "میرا آخری لین دین کیا تھا؟", "list_transactions", "receipt", None),
    ("T2", "Show my recent transactions", "میرے حالیہ لین دین دکھائیں", "list_transactions", "transactions", None),
    # T3 uses a SEEDED counterparty (K-Electric appears in every user's history).
    ("T3", "Show my transactions with K-Electric", "کے الیکٹرک کے ساتھ لین دین دکھائیں",
     "list_transactions", "transactions", None),
    ("T4", "What did I spend last month?", "پچھلے مہینے کتنا خرچ ہوا؟", "spending_summary", "spending", None),
    ("T5", "What did I spend last month compared to the month before?",
     "پچھلے مہینے کا خرچ اس سے پہلے والے مہینے سے موازنہ کر کے بتائیں", "spending_summary", "spending", None),
    # A5d reproduces the live history-echo defect: a topic change right after a card turn
    # (the model replied with the spending sentence verbatim and called nothing).
    ("A5d", "what can you do", "آپ کیا کر سکتی ہیں", "help", "help", "T4"),
    # T6 needs the ids of the list T2 just showed.
    ("T6", "Show me the receipt for the first one", "ان میں سے پہلے کی رسید دکھائیں",
     "get_transaction", "receipt", "T2"),
    ("T7", "I need my statement for last month", "مجھے پچھلے مہینے کی اسٹیٹمنٹ چاہیے", "get_statement", "statement", None),
    ("T8", "List the statements I already have", "جو اسٹیٹمنٹس بن چکی ہیں وہ دکھائیں", "list_statements", "statements", None),
    ("C1", "Show my card", "میرا کارڈ دکھائیں", "get_card", "card", None),
    ("C2", "Freeze my card", "میرا کارڈ بند کر دیں", "freeze_card", "card", None),
    ("C3", "Unfreeze my card", "میرا کارڈ کھول دیں", "unfreeze_card", "confirmation", "C2"),
    # C4 is a prompt rule: refuse the full number, show the masked card instead.
    ("C4", "Read me my full card number", "میرا پورا کارڈ نمبر بتائیں", "get_card", "card", None),
    ("R1", "Show my saved recipients", "میرے محفوظ رابطے دکھائیں", "list_recipients", "recipients", None),
    # R3 cancels the pending unfreeze C3 just created, in the same session.
    # The backend's cancel route answers {cancelled:true}, so this row is text-only.
    ("R3", "Never mind, cancel that", "رہنے دیں، اسے منسوخ کر دیں", "cancel_action", None, "C3"),
    ("B1", "Which bills are due?", "کون سے بل واجب الادا ہیں؟", "list_due_bills", "bills", None),
    ("B2", "Show the bill payments in my history", "میری تاریخ میں بلوں کی ادائیگیاں دکھائیں",
     "list_transactions", "transactions", None),
    ("B3", "Show my saved billers", "میرے محفوظ بلر دکھائیں", "list_saved_billers", "billers", None),
    ("B4", "I want to top up a phone", "مجھے موبائل لوڈ کرانا ہے", "list_telcos", "telco_chips", None),
    ("P1", "Show my savings pockets", "میری بچت پاکٹس دکھائیں", "list_pockets", "pockets", None),
    ("P2", "Make a Hajj pocket with a goal of two lakh", "دو لاکھ کے ہدف والی حج پاکٹ بنائیں",
     "create_pocket", "pocket", None),
    ("P3", "Put one thousand rupees into my Umrah Fund pocket", "عمرہ فنڈ پاکٹ میں ایک ہزار روپے ڈالیں",
     "pocket_deposit", "confirmation", None),
    ("P4", "Take one thousand rupees out of my Umrah Fund pocket", "عمرہ فنڈ پاکٹ سے ایک ہزار روپے نکالیں",
     "pocket_withdraw", "confirmation", None),
    ("Q1", f"Ask {BILAL} for fifteen hundred rupees", f"{BILAL} سے پندرہ سو روپے مانگیں",
     "request_money", "request", None),
    ("Q2", "Who has asked me for money?", "مجھ سے کس نے پیسے مانگے ہیں؟", "list_requests", "requests", None),
    ("Q3", "Approve that request", "وہ درخواست منظور کر دیں", "approve_request", "confirmation", "Q2"),
    ("Q4", "Decline that request", "وہ درخواست رد کر دیں", "decline_request", None, "Q2"),
    ("K1", "Show my QR code", "میرا QR کوڈ دکھائیں", "get_my_qr", "qr", None),
]


async def login(phone: str, pin: str) -> str:
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0) as http:
        started = (await http.post("/auth/request-otp", json={"phone": phone})).json()
        if not started.get("success"):
            raise SystemExit(f"request-otp failed: {started}")
        verified = (await http.post(
            "/auth/verify-otp", json={"phone": phone, "otp": started["data"]["demoOtp"]})).json()
        if not verified.get("success"):
            raise SystemExit(f"verify-otp failed: {verified}")
        headers = {"Authorization": f"Bearer {verified['data']['otpToken']}"}
        route = "/auth/set-pin" if verified["data"].get("isNewUser") else "/auth/verify-pin"
        done = (await http.post(route, json={"pin": pin}, headers=headers)).json()
        if not done.get("success"):
            raise SystemExit(f"{route} failed: {done}")
        return done["data"]["token"]


async def seed_incoming_request(verbose: bool) -> None:
    """Q2/Q3/Q4 need exactly ONE incoming request: log in as Bilal and ask Ammi for ₨1,500.

    Idempotent — repeated smoke runs would otherwise pile up pending requests and the
    model would (correctly) ask "which one?" instead of approving.
    """
    ammi_jwt = await login(AMMI, DEMO_PIN)
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {ammi_jwt}"}) as http:
        items = (await http.get("/requests")).json().get("data", {}).get("items", [])
        incoming = [r for r in items if r["status"] == "pending" and r["direction"] == "incoming"]
        # Leftovers from previous runs make "approve that request" genuinely ambiguous, and
        # the model correctly asks which one — so keep exactly one open.
        for extra in incoming[1:]:
            await http.post(f"/requests/{extra['id']}/decline")
        if incoming:
            print(f"[fixture] one pending incoming request kept ({len(incoming) - 1} old ones declined)")
            if verbose:
                print(f"          request id {incoming[0]['id']}")
            return

    bilal_jwt = await login(BILAL, DEMO_PIN)
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {bilal_jwt}"}) as http:
        res = (await http.post(
            "/requests", json={"fromPhone": AMMI, "amountPaisa": 150000, "note": "Grocery"})).json()
    print(f"[fixture] Bilal -> Ammi money request: {'ok' if res.get('success') else res}")
    if verbose and res.get("success"):
        print(f"          request id {res['data']['request']['id']}")


async def snapshot_profile(jwt: str) -> dict[str, Any]:
    """A3/A4 change the demo user's name and app language on the server — which flips the
    real app's UI. Capture the profile before the run so teardown can put it back."""
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {jwt}"}) as http:
        user = (await http.get("/me")).json().get("data", {}).get("user", {})
    return {k: user.get(k) for k in ("name", "urduName", "language") if user.get(k) is not None}


async def restore_profile(jwt: str, profile: dict[str, Any], verbose: bool) -> None:
    if not profile:
        return
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {jwt}"}) as http:
        res = (await http.patch("/me", json=profile)).json()
    ok_ = res.get("success")
    print(f"[teardown] profile restored: {profile if verbose or not ok_ else ', '.join(profile)}"
          + ("" if ok_ else f" FAILED: {res}"))


async def report_duplicate_pockets(jwt: str, name: str) -> None:
    """P2 creates a pocket every run and the backend has no DELETE /pockets route, so they
    accumulate on the demo account. Surface the count rather than let it drift silently."""
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {jwt}"}) as http:
        items = (await http.get("/pockets")).json().get("data", {}).get("items", [])
    dupes = [p for p in items if name.lower() in p["name"].lower()]
    if len(dupes) > 1:
        print(f"[note] {len(dupes)} '{name}' pockets already exist (no DELETE /pockets route "
              f"— re-seed the demo DB if this grows)")


async def cancel_pending_actions(jwt: str, action_ids: list[str], verbose: bool) -> list[str]:
    """Cancel every confirmation this run created, so no money action is left pending on the
    demo account. Returns the ids that could NOT be cancelled (410 = already handled is fine)."""
    if not action_ids:
        return []
    stuck: list[str] = []
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {jwt}"}) as http:
        for action_id in dict.fromkeys(action_ids):
            res = await http.post(f"/actions/{action_id}/cancel")
            body = res.json()
            if not body.get("success") and body.get("code") != "ACTION_GONE":
                stuck.append(action_id)
            elif verbose:
                print(f"[teardown] action {action_id}: {body.get('code', 'cancelled')}")
    print(f"[teardown] {len(action_ids) - len(stuck)}/{len(action_ids)} pending action(s) cleared")
    return stuck


async def clean_outgoing_requests(verbose: bool) -> None:
    """Q1 asks Bilal for money on every run. Bilal is the payer, so he declines them —
    otherwise they pile up and later runs see an ambiguous list."""
    jwt = await login(BILAL, DEMO_PIN)
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0,
                                 headers={"Authorization": f"Bearer {jwt}"}) as http:
        items = (await http.get("/requests")).json().get("data", {}).get("items", [])
        stale = [r for r in items if r["status"] == "pending" and r["direction"] == "incoming"
                 and r["counterparty"].get("phone") == AMMI]
        for r in stale:
            await http.post(f"/requests/{r['id']}/decline")
    print(f"[teardown] {len(stale)} stale request(s) from Ammi declined")


class Recorder:
    """Records the tool calls a run made, by wrapping build_tools' coroutines."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.errors: list[str] = []

    def install(self):
        original = agent_module.build_tools
        rec = self

        def patched(client, cards_sink, resolved_pairs=None):
            tools = original(client, cards_sink, resolved_pairs)
            for tool in tools:
                inner, name = tool.coroutine, tool.name

                async def runner(_inner=inner, _name=name, **kwargs):
                    rec.calls.append((_name, kwargs))
                    text = await _inner(**kwargs)
                    if isinstance(text, str) and text.startswith("ERROR"):
                        rec.errors.append(f"{_name}: {text[:120]}")
                    return text

                tool.coroutine = runner
            return tools

        agent_module.build_tools = patched
        return original


def classify(expected_tool, expected_kind, kinds, calls, errors):
    if expected_kind is None:
        return (not kinds or expected_kind in kinds), "-"
    if expected_kind in kinds:
        return True, "-"
    if errors:
        return False, "ERROR"
    if expected_tool and expected_tool not in [c[0] for c in calls]:
        return False, "ROUTING"
    if not calls:
        return False, "ROUTING"
    return False, "TOOL/DATA"


async def run_row(jwt, language, utterance, history, verbose):
    client = BackendClient(jwt)
    rec = Recorder()
    original = rec.install()
    try:
        reply, cards = await run_agent(client, history, utterance, language)
    except Exception as e:
        return f"{type(e).__name__}: {e}", [], rec
    finally:
        agent_module.build_tools = original
        await client.aclose()
    return reply, cards, rec


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jwt")
    ap.add_argument("--phone", default=AMMI)
    ap.add_argument("--pin", default=DEMO_PIN)
    ap.add_argument("--language", default="en", choices=["en", "ur", "both"])
    ap.add_argument("--rows", help="comma-separated row ids (e.g. T8,K1); chained rows pull in their parent")
    ap.add_argument("-v", "--verbose", action="store_true", help="per-row tools, args, cards and errors")
    ap.add_argument("--no-fixture", action="store_true", help="skip seeding the incoming money request")
    ap.add_argument("--max-calls", type=int, default=MAX_MODEL_CALLS,
                    help=f"hard cap on real model invocations (default {MAX_MODEL_CALLS})")
    args = ap.parse_args()

    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set — this script needs the real model.")

    wanted = set(args.rows.split(",")) if args.rows else None
    if wanted:  # a chained row is meaningless without the row(s) it follows
        parents = {row_id: after for row_id, _en, _ur, _t, _k, after in ROWS}
        pending = list(wanted)
        while pending:
            parent = parents.get(pending.pop())
            if parent and parent not in wanted:
                wanted.add(parent)
                pending.append(parent)
    languages = ["en", "ur"] if args.language == "both" else [args.language]
    rows = [r for r in ROWS if wanted is None or r[0] in wanted]

    if not args.no_fixture and any(r[0] in ("Q2", "Q3", "Q4") for r in rows):
        await seed_incoming_request(args.verbose)

    jwt = args.jwt or await login(args.phone, args.pin)
    original_profile = await snapshot_profile(jwt)
    if any(r[0] == "P2" for r in rows):
        await report_duplicate_pockets(jwt, "Hajj")
    agent_module.build_model = build_model  # keep the real model in the reply path

    budget = args.max_calls
    print(f"\nlanguage={args.language}  rows={len(rows) * len(languages)}  budget={budget} model calls\n")
    print(f"{'ROW':<5}{'LG':<4}{'RESULT':<7}{'WHY':<11}{'TOOLS':<34}{'CARDS':<24}REPLY")
    print("-" * 120)

    sessions: dict[str, list] = {}   # row_id -> the message history that row left behind
    pending_actions: list[str] = []  # confirmation cards this run created, cancelled in teardown
    passed = failed = skipped = 0
    spent = 0                        # real model invocations, summed from run_agent
    worst_case_per_row = 1 + agent_module.MAX_NUDGES
    # --language both runs each row in English then Urdu, keeping chains inside a language.
    plan = [(lang, row) for lang in languages for row in rows]
    for language, (row_id, en, ur, tool, kind, after) in plan:
        if spent + worst_case_per_row > budget:
            skipped += 1
            print(f"{row_id:<5}{language:<4}{'SKIP':<7}budget: {spent}/{budget} model calls spent")
            continue
        utterance = en if language == "en" else ur
        history = sessions.get((language, after), []) if after else []
        reply, cards, rec = await run_row(jwt, language, utterance, history, args.verbose)
        spent += agent_module.last_turn_model_calls
        kinds = [c["kind"] for c in cards] if isinstance(cards, list) else []
        # Money actions this run prepared (deposit/withdraw/approve/unfreeze) must not be
        # left pending on the demo account — collect them for teardown.
        pending_actions += [c["actionId"] for c in cards if c.get("kind") == "confirmation"]
        ok, why = classify(tool, kind, kinds, rec.calls, rec.errors)
        passed, failed = (passed + 1, failed) if ok else (passed, failed + 1)
        print(f"{row_id:<5}{language:<4}{'PASS' if ok else 'FAIL':<7}{why:<11}"
              f"{','.join(c[0] for c in rec.calls)[:33]:<34}{','.join(kinds)[:23]:<24}"
              f"{' '.join(str(reply).split())[:52]}")
        if args.verbose or not ok:
            for name, kwargs in rec.calls:
                print(f"      tool {name}({', '.join(f'{k}={v!r}' for k, v in kwargs.items())})")
            for err in rec.errors:
                print(f"      backend {err}")
            if not ok:
                print(f"      expected tool={tool} card={kind}; reply: {' '.join(str(reply).split())[:200]}")
        # remember this turn so a chained row can act on the ids it produced
        sessions[(language, row_id)] = [
            *history,
            HumanMessage(content=utterance),
            AIMessage(content=f"{reply}\n{cards_context_line(cards)}".strip()),
        ]

    left = await cancel_pending_actions(jwt, pending_actions, args.verbose)
    await clean_outgoing_requests(args.verbose)
    await restore_profile(jwt, original_profile, args.verbose)

    print("-" * 120)
    print(f"{passed} passed, {failed} failed, {skipped} skipped ({args.language}) "
          f"— {spent} model calls of {budget}")
    if left:
        print(f"WARNING: {len(left)} pending action(s) could not be cancelled: {', '.join(left)}")
    return 1 if failed or left else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Live smoke: run the intent matrix against the REAL model and a REAL backend.

QA tool, never CI — it spends Gemini calls. TTS is forced off (TTS_ENABLED=false) so no
Cartesia credit is ever billed by this script.

  cd services/ai
  uv run python scripts/ai-smoke.py --phone +923001110001 --pin 1234
  uv run python scripts/ai-smoke.py --jwt "<session token>" --language ur --rows A1,T1,C1

Auth: the backend's demo OTP flow — POST /auth/request-otp returns `demoOtp`, verify-otp
gives an otp-scope token, verify-pin (or set-pin for a brand-new phone) exchanges it for a
session JWT. Pass --jwt to skip all of that.

Budget: at most MAX_MODEL_CALLS (40) turns per run; the script stops early and reports the
remaining rows as SKIPPED rather than overspending. Each row is one fresh conversation
(no history), so one row = one turn = at most 1 + MAX_NUDGES model calls.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["TTS_ENABLED"] = "false"  # must be set before app.config is imported

import httpx  # noqa: E402

from app.agent import build_model, run_agent  # noqa: E402
from app.backend_client import BackendClient  # noqa: E402
from app.config import settings  # noqa: E402
from tests.test_intent_matrix import MATRIX  # noqa: E402

MAX_MODEL_CALLS = 40


async def login(phone: str, pin: str) -> str:
    """Demo OTP flow -> session JWT."""
    async with httpx.AsyncClient(base_url=settings.backend_base_url, timeout=20.0) as http:
        started = (await http.post("/auth/request-otp", json={"phone": phone})).json()
        if not started.get("success"):
            raise SystemExit(f"request-otp failed: {started}")
        otp = started["data"]["demoOtp"]
        verified = (await http.post("/auth/verify-otp", json={"phone": phone, "otp": otp})).json()
        if not verified.get("success"):
            raise SystemExit(f"verify-otp failed: {verified}")
        otp_token = verified["data"]["otpToken"]
        headers = {"Authorization": f"Bearer {otp_token}"}
        route = "/auth/set-pin" if verified["data"].get("isNewUser") else "/auth/verify-pin"
        done = (await http.post(route, json={"pin": pin}, headers=headers)).json()
        if not done.get("success"):
            raise SystemExit(f"{route} failed: {done}")
        return done["data"]["token"]


async def run_row(jwt: str, language: str, utterance: str, expected_kinds: list[str], model):
    client = BackendClient(jwt)
    try:
        reply, cards = await run_agent(client, [], utterance, language, model=model)
    except Exception as e:  # a live failure is a FAIL row, not a crashed run
        return False, f"{type(e).__name__}: {e}", ""
    finally:
        await client.aclose()
    kinds = [c["kind"] for c in cards]
    ok = kinds == expected_kinds if expected_kinds else not kinds
    return ok, ", ".join(kinds) or "-", " ".join(reply.split())[:60]


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jwt", help="session JWT; skips the OTP login")
    ap.add_argument("--phone", default="+923001110001")
    ap.add_argument("--pin", default="1234")
    ap.add_argument("--language", default="en", choices=["en", "ur", "both"])
    ap.add_argument("--rows", help="comma-separated row ids (e.g. A1,T1,C1); default all")
    args = ap.parse_args()

    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set — this script needs the real model.")

    jwt = args.jwt or await login(args.phone, args.pin)
    model = build_model()
    languages = ["en", "ur"] if args.language == "both" else [args.language]
    wanted = set(args.rows.split(",")) if args.rows else None

    rows = [
        (row_id, lang, en if lang == "en" else ur, kinds)
        for row_id, en, ur, _calls, kinds, _path in MATRIX
        for lang in languages
        if wanted is None or row_id in wanted
    ]

    print(f"{'ROW':<6}{'LANG':<6}{'RESULT':<8}{'CARDS':<28}{'EXPECTED':<28}REPLY")
    passed = failed = 0
    for i, (row_id, lang, utterance, expected) in enumerate(rows):
        if i >= MAX_MODEL_CALLS:
            print(f"{row_id:<6}{lang:<6}{'SKIP':<8}budget of {MAX_MODEL_CALLS} model calls reached")
            continue
        ok, kinds, reply = await run_row(jwt, lang, utterance, expected, model)
        passed, failed = (passed + 1, failed) if ok else (passed, failed + 1)
        print(f"{row_id:<6}{lang:<6}{'PASS' if ok else 'FAIL':<8}{kinds:<28}{', '.join(expected) or '-':<28}{reply}")

    print(f"\n{passed} passed, {failed} failed, {max(0, len(rows) - MAX_MODEL_CALLS)} skipped")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

# PAYO v5 QA — Every action through the AI, card-only replies, natural Urdu

**Date:** 2026-09-06 · **Spec:** `docs/2026-09-05-payo-v5-full-ai-coverage-design.md` (§7) ·
**Stack:** `payo-mongo` (27018, reseeded before the final pass), backend :4000, AI :8000 (real
Gemini; TTS on for the app, off inside the smoke), Metro :8081, iPhone 17 Pro simulator via
Argent. User: Ammi Jaan (`+923001110001`).

## Gates

| Gate | Result |
|---|---|
| Backend `npm test` / typecheck | 97 passed / clean |
| AI `uv run pytest -q` | 238 passed |
| Mobile `npx jest` / `tsc --noEmit` | 226 passed / clean |
| Reviews | F1: 1 blocker (zero-rupee ledger row for unfreeze) → fixed → approved. F2: approved + 5 should-fixes → fixed. F3: approved + 3 should-fixes → fixed. F2 live fix loop: 4 should-fixes → fixed. |

## Live routing gate — `scripts/ai-smoke.py` (real model, EN + UR)

Every §2 action row is driven live in both languages and classified by (tool called, card
emitted). History of the loop, because the first run is the honest number:

| Run | Result | What it found |
|---|---|---|
| First EN run | 22 / 34 | 5 real defects (statements field name, empty-result dishonesty, request-by-name, pockets routing, help routing) + 7 harness gaps (context chains, exact-match, fixtures, seeded names) |
| After fixes, EN | 34 / 34 | — |
| Final EN + UR (70 rows) | 67 / 70 | T2 intermittent (passes on rerun); UR B4 "which network?" asked in prose; UR "cancel that" routed to help |
| Rerun R3, B4 both languages after deterministic fallbacks | 8 / 8 | telco chips attached even when the model asks in prose; cancel pre-routed with zero model calls when a pending confirmation is in context |
| A4 both languages after the guard-gate fix | 2 / 2 | one profile card, language `en` |

Budget: 104 model calls for the 70-row run. Teardown cancels every pending action the run
created, declines its stale requests, and restores the profile it found.

## Simulator acceptance (spec §7.3)

| Ask | Result | Evidence |
|---|---|---|
| "what was my last transaction" | **PASS** — receipt card only, no text bubble | `T1-receipt-card-only.png` |
| "what did I spend last month compared to the month before" | **PASS** — category bars + red "₨141,356 more than July" row (labels now "August 2026") | `T4-T5-spending-compare.png` |
| "show my card" | **PASS** — masked (last 4), expiry, frozen pill, full-number rule | `C1-card-masked-frozen.png` |
| "unfreeze my card" | **PASS** — PIN sheet opened by itself; after PIN: Completed + card "Active" | `C3-unfreeze-pin-auto-open.png`, `C3-unfreeze-done-card-active.png` |
| "switch to urdu" / "switch to english" | **PASS** — one profile card, whole UI flips (RTL, Nastaliq) | `A4-switch-to-urdu-profile-card.png` |
| "mera balance kya hai" (Roman Urdu, Urdu UI) | **PASS** — balance card only, Urdu label | `A1-roman-urdu-balance-card-only.png` |
| "show my QR code" | **PASS** — QR card with name + phone | `K1-qr-card.png` |
| "what can you do" | **PASS** — help card, 13 tappable rows | `A5-help-card.png` |
| "who owes me money" | card renders; after the fix it lists pending requests only | `Q2-requests-card-before-pending-filter.png` |

Card-only bubbles confirmed on every card kind above: the assistant's sentence is spoken, not
displayed.

## Defects found live and fixed in this cycle

1. Zero-rupee "transaction" written by card unfreeze (leaked into last-transaction, spending,
   statements) → executor writes no ledger row; execute may return `transaction: null`.
2. `list_statements` crashed on the backend's `id` field.
3. Empty filtered results presented as if found ("Here are your transactions with Bilal").
4. "what can you do" answered without the help tool; later, answered by **repeating the
   previous reply verbatim** → history-echo guard.
5. A silent voice clip transcribed as a description of the audio ("the sound of a ball
   bouncing") and sent to the agent → `NO_SPEECH` sentinel; "I didn't catch that".
6. "who owes me" listed declined history → pending-only by default.
7. "which network?" asked in prose (Urdu) → deterministic telco-chips fallback.
8. "cancel that" (Urdu) routed to help → deterministic cancel pre-route.
9. **Language switch flipped back**: the v3 Urdu-language nudge had no tool/card gate, re-invoked
   the model after `update_profile(en)`, which then set `ur` (two profile cards). One predicate
   now gates every guard; regression test asserts one card and one model call.
10. Spending/statement periods shown as raw ISO ranges → "August 2026" / «اگست 2026».
11. Pocket deposit/withdraw were `requiresPin: false` on the backend → PIN.
12. Confirmation card showed "₨0" for non-money actions → hidden.
13. The smoke itself mutated the demo user (name/language) and left pending actions, requests
    and duplicate pockets → teardown now restores/cancels; the demo DB was reseeded.

## Urdu voice (spec §5 / §7.4)

- Owner pick from the U0 clips: **Aryan, warm** (speed 0.9, calm) — wired in config + tts.
- Spoken-register prompt with a banned written-words test; replies on card turns ≤ 2 sentences
  with bullets/markdown stripped before TTS.
- Urdu number-to-words applied before synthesis (unit-tested 0 … 99,99,999); TTS now follows
  the turn's language, not the UI language. Live listening check of the Aryan voice in the app
  is the owner's — the pipeline is unit-verified.

## Not verified here / known limits

- Model routing is probabilistic: the guards and fallbacks make the §2 rows deterministic where
  they can be; a full 70-row run still has ~1 intermittent miss (T2 in one run). Re-run
  `uv run python scripts/ai-smoke.py --language both` before a demo.
- Approve-a-request and pocket withdraw were exercised live through the smoke (confirmation +
  PIN gate), not on the simulator.
- Android not run.
- Reseeding wipes saved recipients/billers; the demo script re-creates them.

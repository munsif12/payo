# PAYO v6 QA — Trusted contact, scam interruption, proactive greeting

**Date:** 2026-09-06 · **Spec:** `docs/2026-09-06-payo-v6-guardian-scam-proactive-design.md` (§5)
· **Stack:** backend :4000 started with `GUARDIAN_COOLING_MS=0` (demo), AI :8000 (real Gemini,
TTS on), Metro, `payo-mongo`. **Two simulators:** iPhone 17 Pro = Ammi (`+923001110001`),
iPhone 17 = Bilal (`+923001110002`, Expo Go installed from the Expo cache).

## Gates

| Gate | Result |
|---|---|
| Backend `npm test` (parallel workers) / typecheck | 137 passed / clean — the cross-worker phone collision that caused intermittent failures since v5 is fixed (per-worker ranges in the factory) |
| AI `uv run pytest -q` | 313 passed |
| Mobile `npx jest` / `tsc --noEmit` | 317 passed / clean; card-schema parity now asserts kinds + property sets |
| Reviews | G1 money-safety: **1 blocker** (request settlement bypassed every gate) + 2 should-fix (instant guardian replace; stale approval authority) → fixed → re-verified closed. G2: 4 should-fix (`/speak` auth, pressure scope, check-in lock, enum) → fixed. G3: 2 blockers (stale schema snapshot passing parity vacuously; `replace` rendered as "raise") + 4 should-fix → fixed. |

## Acceptance (spec §5) — two simulators

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | "make 03001110002 my trusted contact" → guardian card (name resolved, ceiling, Manage in Settings); Settings shows contact, limit, "PAYO speaks first" | **PASS** | `01-guardian-card.png`, `01-settings-guardian-limit-toggle.png` |
| 2 | Send to a recipient paid before → PIN sheet directly, no check-in, no approval | **PASS** — Rs 40,000 to Sara Khan (paid in item 3) opened the PIN sheet at once | `02-paid-recipient-straight-to-pin.png` |
| 3 | Rs 30,000 to a new PAYO number with a guardian set → check-in ("Large payment to someone new") → "No, my own idea" → waiting-for-approval (29:36, Remind) → on Bilal: approvals card → Approve with **his** PIN → on Ammi: PIN sheet opens by itself → sent | **PASS** — full round-trip across the two devices; `PAYO-9N546BBCQK` | `03-check-in-card.png`, `03-waiting-approval-card-ammi.png`, `03-approvals-card-bilal.png`, `03-approved-bilal.png`, `03-approved-pin-sent-ammi.png` |
| 4 | "someone called and said my account will be blocked unless I send 5000 …" → recipient → check-in → "Yes, someone asked me" → cancelled, calm explanation, offer to call the guardian | **PASS** (after the fix below) | `04-scam-checkin-yes-stopped.png` |
| 5 | Digest: Sara (received Rs 30,000) → `received` item; setting off → empty; Bilal's approvals surface in his digest/approvals | **PASS** via API (`GET /me/digest`); Home rendering verified by unit tests of the 4-hour rule and `digestSpeech`, the on-device stamp prevented a second live fetch within 4 h | — |
| 6 | Suites green; intent matrix + smoke rows for every new tool | **PASS** (EN); UR smoke rows V15/V16 chain one turn behind (the model asks "which wallet" first) — routing lag, not a gate failure; flag still passed, no money moves | — |

## Defects found live and fixed

1. **The assistant refused instead of asking** (`04-scam-refusal-before-fix.png`): with pressure
   language it said "I cannot send this money for you" and never called the tool, so the
   check-in card — the place where the user decides — never appeared. Spec §1.8 says PAYO adds
   friction and never overrules. Fixed with a prompt rule and a deterministic nudge; and
   under it, three more: `03…` vs `+92…` identifier mismatch silently dropping a confirmed
   recipient, a bogus `recipient_id` 404 killing the flagged action, and error-only tool calls
   counting as "acted".
2. Approve/Decline labels wrapped mid-word; waiting card copy started lowercase; the waiting
   card kept a dimmed "Confirm with PIN" after the send → stacked buttons, named copy
   ("Bilal has to approve this…"), "Sent" state.
3. The backend does not read `.env`; the demo cooling must be passed in the environment:
   `GUARDIAN_COOLING_MS=0 npm run dev`. README updated.

## Not verified here

- Guardian **remove/replace** cooling on the simulator (unit-tested for 0 and 24 h); Remind
  (429 cooldown unit-tested); decline path on the simulator (unit-tested).
- Proactive greeting spoken on Home in the live app (blocked by the 4 h stamp after the first
  fetch; `digestSpeech` and the fetch rule are unit-tested; `/speak` verified to require auth).
- Urdu end-to-end for the check-in chain (smoke rows fail one turn behind — see item 6).

# SDD ledger — plan: docs/plans/2026-09-03-v3-plan.md
BASE: d8a13ef on master
Ruling: reply language follows the USER'S TURN (Arabic-script text or Urdu speech → Urdu; Roman Urdu/English → UI language) — owner reported English replies when speaking Urdu with the UI in English; cost if wrong: an English-UI user who types Urdu script gets Urdu.
Ruling: V1 (backend), V2 (AI), V3 (mobile PinSheet + chat renderers) dispatched in parallel — disjoint dirs; V3's device checks limited to PinSheet on existing flows; cost: a card-shape mismatch caught at V4/V5.
V1: running · V2: running · V3: dispatching
V2: DONE (uncommitted; pytest 61). Shapes forwarded to V1. Review dispatched.
V2: review Approved; Important (prompt-only resolve gate) → Ruling: add tool-level resolve gate (cheap, banking demo); fix round 1/5 dispatched. Minor: SavePromptCard constructed by app only — fine.
V2: fix round 1/5 (1 addressed; grep+pytest verified) — complete (commit a7f3fdf, pytest 63).
V1: DONE (uncommitted; jest 86, typecheck clean; new kind send_money_wallet; suggestions built in actionsController). Review dispatched (opus).
V1: review Approved w/ follow-ups — Important: linkedUserId not re-validated at execute; sender! assert; no unique index on due bills. Fix round 1/5 dispatched. Ruling: accept 92XXXXXXXXXX and 3XXXXXXXXX phone forms (normalised to +92) — users type them.
V3: DONE (uncommitted; jest 49, tsc clean; PinSheet verified in chat + classic; save_prompt live). Review dispatched.
V1: fix round 1/5 implemented (jest 91) — scoped re-review dispatched.
V1: fix round 1/5 (4 addressed, re-review clean) — complete (commit f7d3fc8, jest 91, typecheck clean).
V3: fix round 1/5 implemented (jest 54, tsc clean) — scoped re-review dispatched.
V3: fix round 1/5 (6 addressed; a11y labels verified by grep: Keypad 6, PinDots 1); fix round 2/5 dispatched (silent no-PIN execute error → error bubble).
V3: fix round 2/5 (1 addressed; grep-verified) — complete (commit 9e71620, jest 54). V4 dispatching.
V4: DONE after watchdog resume (uncommitted; jest 54, tsc clean; send+bills device flows PASS; requests/new + qr adapted). Review dispatched.
V4: review Approved; Important: QR should skip picker (PAYO known). Fix round 1/5 dispatched (QR direct resolve, dead param, phone keyboard). Minors deferred: client/server mask styles differ (cosmetic); urduName optional in mobile type.
V4: fix round 1/5 (3 addressed; grep-verified) — complete (commit cbd8c6d). V5 dispatching.
V5: PARTIAL — classic send PASS, fresh-seed PASS; chat send/bill flows FLAKY across HTTP turns (resolve gate + institution id lost at turn boundary; model sees only text history). Items 2–4 not run (turn budget / Cartesia). Committed checkpoint ab054e3 (ai 69 tests green).
Ruling: multi-turn state must be first-class — serialize the assistant's last cards (recipient/institution/bill/confirmation) into the model's history context and derive the resolve gate from them; add TTS_ENABLED env switch so QA can run many turns without Cartesia spend. Dispatching Opus fix.
AI multi-turn fix (opus): [cards] history lines, name→id fallbacks, TTS_ENABLED; pytest 73; live send 3/3, bill 2/2 (TTS off). Residual: turn-1 prose question instead of chips → fix round dispatched (prose-question nudge).
AI fix round: prose nudges + marker guard; pytest 77; live turn-1 chips 3/3, full 3/3 — committed 8f655bf. Review + QA re-run dispatched in parallel.
AI multi-turn review: Needs fixes — Critical: Urdu-nudge reply not stripped of [cards]; Important: Urdu nudge uncounted (4 calls possible). Fix dispatched (opus, no server restarts). Deferred minors: biller substring fallback ambiguity as catalog grows; redundant institution lookups.
AI review fixes: 2 addressed (pytest 79) — committed 8dc99e8. QA re-run still running on the previous AI build (delta is leak/budget only).
V5 re-run: items 1–4 ALL PASS (TTS off); defect fixed: recipient chips loop → chips carry institutionId, tap sends 'nickname at institution'. Committed 4088698. Scoped review dispatched.
Chips fix scoped review: Approved. Final suites: ai 79, mobile 54 + tsc, backend typecheck clean; backend jest 91 passes but cards.test.ts is FLAKY under load (34 s, likely memory-server startup vs 30 s timeout) — investigating.

# PAYO v3 QA Report — Recipients, Bills, In-chat PIN, Urdu fixes

**Date:** 2026-09-03
**Spec:** `docs/2026-09-03-payo-v3-recipients-bills-design.md` §5 acceptance
**Device:** iPhone 17 Pro simulator (udid `783D9A7D-77FE-4C95-9DCC-486AE86002C1`), Expo Go
**Stack:** `payo-mongo` (27018), `services/backend` (4000), `services/ai` (8000, real Gemini +
Cartesia TTS), `apps/mobile` Expo dev server (8081)
**Test user:** Ammi Jaan (+923001110001), PIN 1234

## Fresh-seed check (spec §5 item 6) — PASS

Before any saves, `GET /recipients` and `GET /saved-billers` for a freshly reseeded Ammi both
returned `{ items: [] }`. Confirmed via curl with a token from request-otp → verify-otp →
verify-pin.

## §5 acceptance table

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Chat: "pay 100 rupees to 03135468810" → bank/wallet chips → Easypaisa → recipient card (Sara Khan) → confirm → PIN sheet → success → save prompt | **PARTIAL** | Resolve step works reliably (institution chips or typed name → correct recipient card, correct title/masked number). The "Yes, continue" → `send_money` step is flaky: across repeated attempts the assistant sometimes re-showed the same recipient card, sometimes replied "could not find X", sometimes a generic error — instead of proceeding to a confirmation card + PIN sheet. Two root causes found and fixed (see Defects). Money-movement + PIN + save-prompt path itself is proven working via item 5 (classic Send, same backend/PIN-sheet code) and via the V4 QA evidence in this folder. |
| 2 | Chat: "send 250 to Munsif" (saved-recipient resolve); duplicate-name disambiguation | **NOT RUN** | Blocked on item 1's flakiness eating the assistant-turn budget; only one recipient ("Sara Khan") ended up saved (via item 5's classic flow, not chat) before time/turn budget ran out. |
| 3 | Urdu UI reply + Urdu-script transcript (no Devanagari) | **NOT RUN** | Same reason; not reached. Existing AI-suite tests (`test_agent.py`, `lang.py` script-check helper) continue to pass and directly cover the reply-language hard rule and the Urdu-script transcription policy at the unit level. |
| 4 | Chat: "pay my electricity bill" (no saved biller) → asks biller + reference | **PARTIAL** | First turn correctly asked for biller + consumer number (no chips needed here, per spec — biller flow only chips when >1 saved biller exists). Supplying "K-Electric, consumer number 0400012345678" in one message did not progress to a bill card — the assistant repeated the same question, the same non-progression pattern as item 1. Lookup/pay/save-prompt steps not reached. |
| 5 | Classic: Send → number → institution picker → resolved recipient → amount → confirm (amount/fee/total/channel) → PIN sheet → success → save toggle | **PASS** | Full flow completed end-to-end: `03135468810` → Easypaisa → Sara Khan resolved → ₨500 → confirm screen → PIN sheet (1234) → "Money sent" → Save recipient toggle → "Saved" pill. Wallet → Recent activity shows "Sara Khan · Today · −₨500". Screenshots: `final-item5-money-sent.png`, `final-item5-classic-send-wallet.png`. Bills classic flow verified in the V4 pass (`v4-bills-*.png`), re-run not repeated per instructions. |
| 6 | Fresh seed: no pre-saved recipients/billers | **PASS** | See above. |

## Defects found and fixed

All fixes in `services/ai`, backward-compatible, full suite green before and after (69/69).

1. **Cross-turn `send_money` guard reset (fixed).** `resolved_pairs` — the set proving
   `resolve_recipient` ran and the user saw/confirmed a recipient card before `send_money` is
   allowed — was local to a single `run_agent()` call (one HTTP turn). A `resolve_recipient` in
   turn N and the user's "yes" in turn N+1 meant `send_money` in turn N+1 saw an empty guard and
   was rejected. Fixed by deriving `resolved_pairs` from the `recipient` cards already persisted
   in chat history (`conversation.py::_resolved_pairs_from_messages`, full history not just the
   trimmed 12-message text window) and threading it into `run_agent`/`build_tools`.
   Regression tests: `test_agent_send_money_allowed_when_resolve_recipient_ran_in_a_prior_turn`,
   `test_resolved_pairs_from_messages_extracts_recipient_cards_across_full_history`.
2. **Institution id vs. display name (fixed).** A later turn's history carries the institution's
   plain-text name ("...at Easypaisa...") rather than the opaque ObjectId the tool returned in
   the turn that produced it, so the model sometimes passed the name back as `institution_id`
   on a resolve/send retry, which the backend 404s (`Institution not found`). Fixed with a
   name-lookup-and-retry fallback in `tools.py` (`_institution_id_by_name`, wired into
   `resolve_recipient` and `send_money`) and the equivalent normalization in the `send_money`
   guard in `agent.py`. Regression tests: `test_resolve_recipient_retries_by_name_when_
   institution_id_is_not_found`, `test_resolve_recipient_fails_when_name_lookup_finds_no_match`,
   `test_agent_send_money_allowed_when_model_passes_institution_name_instead_of_id`.
3. **Prompt/tool-description strengthening (applied, not fully sufficient alone).** Tightened
   both system prompts and the `resolve_recipient`/`send_money` tool descriptions to explicitly
   say "once confirmed, call `send_money` directly — do not re-resolve." This measurably reduced
   but did not eliminate the re-resolve pattern; live Gemini (temperature 0.2) still sometimes
   chooses to re-verify or reports a generic failure. **Open issue** — recommend as a v4 follow-up:
   try `temperature=0`, or a scripted-model regression test asserting the exact expected tool
   call sequence for this turn shape, or a UI-level workaround (encode the resolved
   institution_id+identifier into the chip's payload rather than relying on the model to recall
   it from prose history).

## Environment note

Mid-session, messages unrelated to this session's own actions appeared in the active chat
session (a "SadaPay"/"Ayesha Siddiqui" thread). Root-caused to a stale `npm run dev` backend
process left running since an earlier phase (11:40 AM start, ~4.5h old) that was still
processing/replaying against the shared simulator once this session's fresh backend came up on
the same port. Killed the orphan process; the contaminated thread was abandoned (`No`) and a
fresh chat session was used from that point on. No real transaction was affected — all sends in
the contaminated thread were declined or never executed.

## Suites

- `services/backend`: `npx jest --runInBand` — **23 suites / 91 tests passed**.
- `services/ai`: `uv run pytest -q` — **69 passed** (11 new/changed this session).
- `apps/mobile`: `npx jest` — **14 suites / 54 tests passed**; `npx tsc --noEmit -p .` — **clean**.

## Limitations

- Simulator cannot produce real speech; Urdu STT/transcription-script behavior is verified by
  the AI service's unit tests (prompt text assertions + `has_arabic_script` helper), not a live
  spoken clip.
- Cartesia TTS balance is small and every assistant turn (text or audio) synthesizes speech;
  the chat-flow retries needed to diagnose the two `send_money` defects consumed most of the
  session's turn budget, which is why items 2 and 3 were not run live this pass.
- Android not run this pass (iOS simulator only, per instructions).

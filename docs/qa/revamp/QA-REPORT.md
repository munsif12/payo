# PAYO Revamp v2 — QA Report

**Date:** 2026-09-03
**Scope:** Phase R7c final acceptance QA for the revamp (AI-first Home, phone-only auth,
new design system) — spec §7 acceptance criteria in
`docs/2026-09-02-payo-revamp-design.md`.
**Stack under test:** backend :4000, AI service :8000, Metro :8081, Mongo (replica set)
:27018 — all running locally, seeded demo world. Mobile client: Expo Go on iOS
Simulator, iPhone 17 Pro (udid `783D9A7D-77FE-4C95-9DCC-486AE86002C1`), driven via
Argent MCP tools.

## Acceptance criteria (spec §7)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Fresh install → phone → OTP (demo code shown) → Create PIN → Home greets "PAYO user" | PASS | `final-01-home-en.png`, `final-01-otp-demo-banner.png` |
| 2 | Seeded Ammi: phone → OTP → Enter PIN → Home greets "Ammi Jaan"; "Pay a bill" card names K-Electric ₨4,320 → assistant bill card → Yes → PIN → success → Wallet balance updated | PASS | `final-02-home-ammi.png`, `final-02-bill-card.png`, `final-02-enter-pin-ammi.png`, `final-02-success.png`, `final-02-wallet-balance.png` |
| 3 | Typed Roman-Urdu send with UI in English → English reply + confirmation card → PIN → success; same with UI in Urdu → Urdu reply | PASS | `final-03-confirmation-en.png`, `final-03-home-urdu-rtl.png`, `final-03-profile-urdu.png` |
| 3b | Two-Sara disambiguation resolves correctly with tappable chips | PASS | `final-03-two-saras-urdu.png` |
| 4 | Dark mode follows system; Urdu toggle flips UI and reply language | PASS | `final-04-home-dark.png`, `final-04-wallet-dark.png` |
| 5 | Motion: greeting rise + card stagger on Home open; listening state; PIN dot fill; wrong-PIN shake | PASS | `final-05-home-open-motion.png`, `final-05-listening.png`, `final-05-wrong-pin-shake.png` |
| 6 | All suites green; screen-by-screen visual pass across the app | PASS | see Test suites below + screenshots listed under Screen review |

## Screen review (item 6 — full-app visual pass)

Screens covered, checked against `docs/design/revamp-v1/*.dc.html`:

| Screen | File | Notes |
|---|---|---|
| Wallet | `final-06-wallet.png` | Matches BalanceCard/actions/pockets layout |
| Activity | `final-06-activity.png` | Grouped-by-month rows, category chips, matches artboard |
| Receipt | `final-06-receipt.png` | Matches design; Save/Share buttons present but decorative (see limitations) |
| Pay hub | `final-06-pay-hub.png` | Matches artboard grid |
| Send — recipient | `final-06-send-recipient.png` | Matches |
| Send — amount | `final-06-send-amount.png` | Matches |
| Bills | `final-06-bills.png` | Matches due-card + list layout |
| Pockets | `final-06-pockets.png` | Matches |
| Card | `final-06-card.png` | Matches `Card.dc.html` — navy card, Show number/Freeze/Limits actions, active toggle, card activity list |
| Statements | `final-06-statements.png` | Matches `Statements.dc.html` — month picker, "No statements yet" empty state, English-PDF disclaimer text present |
| More | `final-06-more.png` | Matches `More.dc.html` — profile header, Savings/Card/Statements/Requests, Language row showing "English" |
| Profile | `final-06-profile-en.png` | Matches — avatar, name/email/phone, Urdu/English toggle with English selected |

No visual defects found on Card, Statements, More, or Profile versus their artboards.
Note: a small floating gear icon appears near the top-left on several screens
(`gearshape.fill`) — this is an Expo Go / dev-tooling overlay (not present in app
source, `grep` for `gearshape` in `apps/mobile/src` returns no matches), not a
product defect; it will not appear in a standalone build.

## Test suites

```
services/backend  npx jest --runInBand   → Test Suites: 22 passed, 22 total · Tests: 81 passed, 81 total
services/ai       uv run pytest -q       → 40 passed, 15 warnings (deprecation warnings only, no failures)
apps/mobile       npx jest               → Test Suites: 12 passed, 12 total · Tests: 35 passed, 35 total
apps/mobile       npx tsc --noEmit -p .  → clean, no errors
```

## Defects fixed during QA

Two mobile defects were found and fixed in `apps/mobile` while exercising the flows
above (uncommitted; jest + tsc kept green throughout):

1. **`src/api/authGuard.ts` — wrong PIN on bill/transfer execution force-signed the user
   out.** `POST /actions/:id/execute` with an incorrect PIN also answers `401
   INVALID_PIN` (see `services/backend/src/lib/pendingActions.ts`), which is a mistyped
   PIN on an otherwise-healthy session, not a dead one — the PIN screen already handles
   it itself (shake + inline error, letting the user retry). The old `shouldSignOut`
   treated any 401 outside `/auth/*` as a dead session and bounced the user back to the
   phone screen, destroying the Flow A/D "wrong PIN, try again" beat. Fixed by excluding
   `/actions/:id/execute` from the sign-out check via a dedicated `isActionExecute`
   matcher, with the reasoning documented inline.
2. **`src/store/index.ts` — RTK Query cache leaked across account switches.** Every
   query result is cached by endpoint name with no per-user key, so signing out and
   signing back in as a different seeded user (e.g. Ammi → Bilal) kept serving the
   previous user's cached `/me`, `/bills/due`, balance, etc. until each query happened
   to refetch on its own. Fixed by adding an RTK `createListenerMiddleware` that calls
   `payoApi.util.resetApiState()` on both `signedIn` and `signedOut`, so every session
   transition starts from a clean cache under the new auth token.

## Known limitations

- The iOS Simulator's software keyboard cannot type Urdu script — Urdu-language
  verification relied on the app's own Urdu replies/UI (toggle, RTL layout, Nastaliq
  rendering) rather than typing Urdu input; Roman-Urdu and English typed input were used
  to drive the agent instead.
- No real microphone input was exercised — voice flows were verified via the typed
  fallback and the listening/thinking motion states only, not live speech-to-text.
- Cartesia TTS API balance is small; audio-out was not exhaustively exercised to avoid
  exhausting it. Text + card responses were verified in full.
- Android emulator was not run this session (iOS Simulator only); the revamp spec marks
  Android as "if the emulator boots," and it was not exercised in R7c.
- Save/Share on the Receipt screen and the Limits control on the Card screen render per
  design but are decorative (no backing action) in this demo build.
- Statement PDFs are English-only regardless of the app's display language, per design
  (`final-06-statements.png` shows the disclaimer copy).

# PAYO Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One
> subagent per task; tests green before every commit; the orchestrator commits.

**Goal:** Ship the approved v2 design: phone-only auth, AI-first animated Home, Wallet tab,
English-first bilingual assistant, new design system across every screen.

**Spec:** `docs/2026-09-02-payo-revamp-design.md` · **Artboards (exact values):**
`docs/design/revamp-v1/*.dc.html` · **Contracts:** `docs/plans/2026-09-01-payo-roadmap.md`
(+ §3 amendments in the spec).

**Tech:** unchanged stacks. New mobile deps: `lucide-react-native`,
`@expo-google-fonts/plus-jakarta-sans`, `expo-haptics`. Reanimated 4 already installed.

## Global constraints

Roadmap globals apply. Plus: every UI value comes from the artboards/Foundations (no invented
colors/sizes); no emoji icons; touch ≥44pt; body ≥17; reduced-motion respected; TDD for
backend/AI; mobile logic (hooks, formatters, reducers) unit-tested with jest; screens verified
on the iOS simulator via Argent at phase gates; nothing pushed to any remote.

## Phase R1 — Backend: phone-only auth, due bills, profile

Files: `services/backend/src/{models/User.ts, models/Bill.ts, models/OtpCode.ts, lib/tokens.ts,
middleware/requireAuth.ts, controllers/authController.ts, controllers/billsController.ts,
controllers/meController.ts (new), routes/*, seed/*, testUtils/factories.ts}` + tests.

- [ ] **R1.1 Models.** `User`: `email` optional (drop unique), `pinHash` optional,
  `pinSet: {type:Boolean, default:false}`, `phone` stays unique/required. `Bill`: add
  `userId?: ObjectId` (index). `OtpCode`: key by `phone` (string) instead of userId, add
  `attempts`. Tests: creating a user without email/pin works; bill accepts userId.
- [ ] **R1.2 Tokens.** `signSession(user)` (payload `{sub,email?,scope:'session'}`, 30d) and
  `signOtpToken(user)` (`{sub, scope:'otp'}`, 10m). `requireAuth` → 401 `OTP_SCOPE` when
  `scope==='otp'`; new `requireOtpOrSession` middleware for `set-pin`/`verify-pin` that sets
  `req.userId` and `req.tokenScope`. Tests for both rejections.
- [ ] **R1.3 Auth routes.** `POST /auth/request-otp {phone}` (zod `+92\d{10}`): find-or-create
  user (+Account welcome 1_000_000, +Card) in a transaction; upsert OtpCode (6 digits, 5 min);
  → `{ demoOtp, isNewUser }`. `POST /auth/verify-otp {phone, otp}`: 400 `INVALID_OTP` (max 5
  attempts → 429 `OTP_LOCKED`), on success delete code → `{ otpToken, isNewUser: !pinSet,
  pinSet }`. `POST /auth/set-pin {pin}` (otp scope only; 409 `PIN_ALREADY_SET`) → sets hash,
  `pinSet=true` → `{ token, user }`. `POST /auth/verify-pin {pin}`: otp scope → `{token,user}`
  or 401 `INVALID_PIN`; session scope → `{valid:true}`. Remove `signup`/`login` + their
  tests. Factory `createVerifiedUser` → request-otp → verify-otp → set-pin. Full-flow tests:
  new user path, returning user path, wrong PIN, otp token rejected on `/me`.
- [ ] **R1.4 Profile + due bills.** `PATCH /me {name?, urduName?, language?}` → updated
  `publicUser`. `GET /bills/due` → user's due bills (bill.userId); `POST /bills/lookup` sets
  `bill.userId = req.userId` when creating/refreshing. Seed: Ammi's K-Electric bill carries her
  userId; all users `pinSet:true`, no emails required (keep `<name>@payo.demo` as optional
  email for reference). Tests: due list scoped per user; seed test updated.
- [ ] **R1.5 Gate.** `npm test` green; e2e smoke updated to the new auth; `docs/plans/
  2026-09-01-payo-roadmap.md` Contract 1 table amended per spec §3; commit.

## Phase R2 — AI service: bilingual reply rule + due-bills tool

Files: `services/ai/app/{agent.py, tools.py, backend_client.py}` + tests.

- [ ] **R2.1 Prompt.** Both system prompts gain: "The user may write or speak in English,
  Urdu script, or Roman Urdu (e.g. 'bijli ka bill pay karna hai'). Always understand all
  three. ALWAYS reply in {English|Urdu} regardless of the input language." Suggestion intents
  ("I want to pay a bill", "Send money", "Check my balance", "Top-up a phone", "Get my
  statement") are listed with the tool to start from. Test: `system_prompt('en')` contains the
  reply-language rule.
- [ ] **R2.2 Tool.** `list_due_bills` → `GET /bills/due`; returns text + `bill` card per due
  bill; `pay_bill` unchanged. Agent rule: for "pay a bill" call `list_due_bills` first; if one
  bill → `pay_bill(bill_id)` immediately (confirmation card). Tests with fake backend: pay-a-
  bill intent yields a `confirmation` card; Roman-Urdu input with language `en` → the scripted
  model receives the English rule (assert prompt).
- [ ] **R2.3 Gate.** `uv run pytest` green; commit.

## Phase R3 — Mobile foundation: tokens, fonts, icons, UI kit, motion primitives, i18n

Files: `apps/mobile/src/{theme/tokens.ts, theme/useTheme.ts, ui/*, motion/*, i18n/*}`,
`app/_layout.tsx`, `package.json`.

- [ ] **R3.1 Deps + fonts.** Add `lucide-react-native`, `@expo-google-fonts/plus-jakarta-sans`,
  `expo-haptics`. Load Plus Jakarta 400–800 + Nastaliq in `_layout.tsx`.
- [ ] **R3.2 Tokens.** `tokens.ts`: `light`/`dark` palettes (spec §2 verbatim), `type`, `radius`,
  `space`, `shadow`. `useTheme()` → `{ c: palette, dark: boolean }` from `useColorScheme()`.
  `useReducedMotion()` from `AccessibilityInfo`. Unit test: palettes contain every key of the
  spec, no `#` value outside the spec list.
- [ ] **R3.3 UI kit** (`src/ui/`): `Text` (variants money/h1/h2/hl/body/sub/foot/cap; Urdu
  font + line-height when `i18n.language==='ur'`; `allowFontScaling`, max multiplier 1.6),
  `Button` (primary/secondary/ghost/danger; 56pt; press scale 0.98 100ms + haptic selection),
  `Card`, `ListRow`, `Chip`, `Pill`, `Avatar` (initials), `Input`, `Keypad` (64/72pt keys, left
  slot, backspace), `PinDots` (fill 150ms, shake 4px/200ms on error), `TabBar` (4 items,
  lucide icons Sparkles/Wallet/Send/MoreHorizontal, amberDeep active), `AIBar` (navy pill,
  amber mic, keyboard icon; onPress → Home), `Composer` (input + 64pt mic; listening variant
  with `ListeningRings`), `Screen` (safe area + bg). Every component mirrors its artboard
  markup 1:1 in values.
- [ ] **R3.4 Motion primitives** (`src/motion/`): `useRise(delayMs)` (300ms, ease-out
  cubic-bezier(0,0,.2,1), translateY 12→0 + opacity), `Rise` component with `delay`,
  `usePressScale`, `Breathe` (2.4s, 1→1.04), `ListeningRings` (2 rings, 1.8s, scale 1→2.1,
  opacity .5→0, 600ms offset), `WaveBars` (10 bars scaleY, 900ms), `TypingDots` (3 dots 1.2s,
  150ms offset), `useCountUp(paisa, 250ms)`, `useShake()`. All no-op (opacity only, no loops)
  when reduced motion is on. Unit tests for the pure timing config (`motion/config.ts`) so the
  numbers match `Motion.dc.html`.
- [ ] **R3.5 i18n.** Default language `en`; add every new string from the artboards to
  `en.json` + `ur.json` (auth.phone.*, auth.otp.*, auth.pin.*, home.greeting, home.suggest.*,
  wallet.*, motion hints, etc.). Tests: every key in `en.json` exists in `ur.json`.
- [ ] **R3.6 Gate.** `npx jest` + `tsc --noEmit` green; a `/dev/kit` route renders the kit
  (temporary, deleted in R7); Argent screenshot of it; commit.

## Phase R4 — Mobile auth + shell

- [ ] **R4.1 Auth screens** `app/(auth)/phone.tsx | otp.tsx | create-pin.tsx | enter-pin.tsx`
  per artboards Phone/Otp/CreatePin/EnterPin; RTK Query endpoints `requestOtp`, `verifyOtp`,
  `setPin`, `verifyPinOtp`; auth slice gains `otpToken`, `pendingPhone`, `isNewUser`; AuthGate:
  no session token → `/(auth)/phone`; otpToken present → create-pin or enter-pin. OTP screen
  shows the demo banner. Remove login/signup screens. Enter PIN greets by name.
- [ ] **R4.2 Tabs** `app/(tabs)/_layout.tsx` with custom `TabBar`; routes `index` (Home),
  `wallet`, `pay`, `more`; `app/activity.tsx` moved out of tabs; AIBar rendered on wallet/pay/
  more via a layout wrapper.
- [ ] **R4.3 Gate.** Argent: fresh state → phone → OTP → create PIN → tabs; seeded Ammi →
  enter PIN → tabs. Screenshots to `docs/qa/revamp/`; commit.

## Phase R5 — AI-first Home + Wallet

- [ ] **R5.1 `useHomeGreeting`**: builds greeting (time-of-day + name, en/ur) and the five
  suggestions; the bill suggestion subtitle comes from `GET /bills/due` (first due bill) else a
  generic line. Unit-tested.
- [ ] **R5.2 Home screen** `app/(tabs)/index.tsx`: header (avatar, greet, name, balance pill
  with reveal), greeting bubble (Rise), `SuggestionCard`×5 (Rise stagger 60ms), `Composer`
  (mic Breathe; keyboard → inline input), transcript list with bubbles + chat cards, listening
  state (rings + wave bars + live transcript), thinking (TypingDots). Tapping a suggestion
  sends its i18n intent text as a turn. Confirmation card → existing confirm/PIN flow; done
  state preserved. Voice recording via existing `useRecorder`.
- [ ] **R5.3 Wallet** `app/(tabs)/wallet.tsx` per artboard (BalanceCard with Send/Request/QR,
  QuickActions, due-bill strip, recent activity ×3 + See all → `/activity`). Balance count-up
  on change.
- [ ] **R5.4 Gate.** Argent: greeting + stagger visible; tap "Pay a bill" → bill card → Yes →
  PIN → success → Wallet balance updated; typed Roman-Urdu send → English reply; Urdu toggle →
  Urdu reply. Screenshots; commit.

## Phase R6 — Remaining screens restyle

- [ ] **R6.1** Pay hub, Send (recipient/amount), Confirm, PIN gate, Success — per artboards
  (success: check lands 400ms then text rises 300ms; haptic success).
- [ ] **R6.2** Activity (chips, month summary card, grouped rows), Receipt, Bills (due card +
  biller list), Pockets (navy total card + progress), Card (gradient card visual, actions),
  Statements, More (profile header, grouped lists, Language row → toggle, Log out danger).
- [ ] **R6.3 Gate.** Argent pass over every screen (both themes on Home/Wallet); commit.

## Phase R7 — Polish, QA, docs

- [ ] **R7.1** Delete `/dev/kit`; remove dead components/i18n keys; `tsc`, jest, backend,
  AI suites green.
- [ ] **R7.2** Full Argent acceptance run (spec §7) on iOS; Android if the emulator boots
  within 10 min; `docs/qa/revamp/QA-REPORT.md`.
- [ ] **R7.3** Update README, DEMO-SCRIPT (new auth + AI-first home), roadmap status; commit.

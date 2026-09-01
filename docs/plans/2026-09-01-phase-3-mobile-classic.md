# PAYO Phase 3 — Mobile Classic Layer Implementation Plan

> **For agentic workers:** Execute task-by-task with checkboxes. Contracts are authoritative in
> `docs/plans/2026-09-01-payo-roadmap.md` (Contract 1 REST API; PendingAction/Txn shapes; Contract 4 seed world).

**Goal:** The complete classic wallet UI against the real backend: auth flow (login/signup/OTP),
tab shell, Activity, full Pay flows (send Payo/bank, QR, bills, recharge, requests), pockets,
card, statements, profile + language toggle — Urdu-first RTL, elder-friendly sizing, verified on
iOS simulator + Android emulator via Argent.

**Architecture:** Expo Router file routes. RTK Query for all API calls (single `payoApi` with
`fetchBaseQuery` injecting the JWT). Redux slice `auth` holds `{ token, user }`, persisted in
AsyncStorage. Every money-moving flow ends in the shared `ConfirmActionScreen` which renders a
PendingAction (summary/lines/fee), collects the 4-digit PIN when `requiresPin`, POSTs
`/actions/:id/execute`, and shows the shared `SuccessScreen`. Route guard: `app/(auth)` group for
unauthed, `app/(tabs)` for authed, redirect in root layout.

**Backend base URL:** iOS simulator `http://127.0.0.1:4000`; Android emulator `http://10.0.2.2:4000`
(picked via `Platform.OS`), overridable with `EXPO_PUBLIC_API_URL`.

**Testing:** jest for pure logic (money, cursor paging helpers, api url builder). UI verified via
Argent on both platforms with proof screenshots in `docs/qa/phase-3/`.

---

### Task 1: Foundation — store, api client, auth slice, guarded routing

**Files:** `src/store/index.ts`, `src/store/authSlice.ts`, `src/api/client.ts` (RTK Query `payoApi`
with tagTypes `Me,Txns,Contacts,Pockets,Requests,Card,Statements,Chat`), `src/api/types.ts`
(Txn/PendingAction/Card DTO types mirroring Contract 1), `src/lib/backendUrl.ts` (+ test),
`app/_layout.tsx` (Redux Provider + auth-gate redirect), AsyncStorage persistence of `{token,user}`.

- [ ] jest test: `backendUrl()` returns platform-correct default and env override wins.
- [ ] Implement store/api/auth slice; app boots to login when no token.
- [ ] Commit `feat(mobile): rtk-query client, auth store, guarded routing`.

### Task 2: Shared UI kit (design-token driven)

**Files:** `src/components/` — `Screen` (safe-area + bg), `UrduText`/`AppText` (Nastaliq vs LTR,
size floor 18), `MoneyText` (formatPaisa, 44pt variant), `PrimaryButton` (56pt), `Tile`,
`ListRow`, `Field` (large TextInput), `PinPad` (4-dot + digit grid), `OtpBoxes`, `SheetHeader`,
`EmptyState`, `ErrorBanner`. i18n: extend `ur.json`/`en.json` with all Phase 3 strings.

- [ ] Implement components; jest snapshot-free smoke test for PinPad digit logic.
- [ ] Commit `feat(mobile): shared ui kit + full ur/en strings`.

### Task 3: Auth flow screens

**Files:** `app/(auth)/login.tsx` (email+PIN via PinPad), `app/(auth)/signup.tsx`,
`app/(auth)/otp.tsx` (shows `demoOtp` prominently — mock flow), root redirect logic.

- [ ] Login as `ammi@payo.demo`/`1234` works against seeded backend; bad PIN shows Urdu error.
- [ ] Signup → OTP screen displays code → verify → lands in tabs with ₨10,000.
- [ ] Commit `feat(mobile): auth flow — login, signup, mock otp`.

### Task 4: Tab shell + Home header

**Files:** `app/(tabs)/_layout.tsx` — 4 tabs ہوم/سرگرمی/ادائیگی/مزید (icons, Nastaliq labels,
dark tab bar); `app/(tabs)/index.tsx` = existing voice home + balance header (tap-to-reveal via
`GET /me`, hidden shows `₨ ••••`).

- [ ] Tabs render on both platforms; balance reveals on tap.
- [ ] Commit `feat(mobile): tab shell + balance header`.

### Task 5: Activity — list, filters, receipt

**Files:** `app/(tabs)/activity.tsx` (FlatList + cursor infinite scroll, type filter chips,
pull-to-refresh), `app/txn/[id].tsx` receipt view (big amount, counterparty, ref no, date).
Cache txn list in RTK Query with cursor merge (+ jest test for merge function).

- [ ] Seeded history renders; filter by bills works; tap opens receipt.
- [ ] Commit `feat(mobile): activity list with filters and receipt`.

### Task 6: Shared money-confirmation flow

**Files:** `app/confirm/[actionId].tsx` — fetches nothing (action passed via route params/store),
renders summary.ur/lines/amount/fee, big تصدیق button → PinPad (when requiresPin) →
`POST /actions/:id/execute` → success screen (`app/success.tsx`) with ref no; cancel → `POST cancel`.
Handles 401 INVALID_PIN (shake + retry), 410 (expired message), 400 INSUFFICIENT_FUNDS.

- [ ] Commit `feat(mobile): shared confirm→pin→execute flow`.

### Task 7: Pay hub + send money (Payo, bank, contact)

**Files:** `app/(tabs)/pay.tsx` (hub tiles: بھیجیں/QR/بل/لوڈ/درخواستیں), `app/send/index.tsx`
(recipient: contacts list + new phone + new bank), `app/send/amount.tsx` (big numpad),
bank path: bank picker + IBAN field → `resolve-title` shows account title before continuing.
→ `POST /transfers` → confirm flow.

- [ ] Send ₨1,500 Ammi→Bilal E2E on simulator: balance drops, Activity shows it.
- [ ] Bank send shows resolved title + ₨25 fee line.
- [ ] Commit `feat(mobile): send money flows`.

### Task 8: QR — my code + scan

**Files:** `app/qr/mine.tsx` (render `GET /qr/mine` payload as QR via react-native-qrcode-svg),
`app/qr/scan.tsx` (expo-camera scanner → `POST /qr/resolve` → prefilled send flow; graceful
no-camera fallback with manual paste field for simulators).

- [ ] My QR renders; resolve of a pasted payload opens send flow (camera untestable in sim — note in QA).
- [ ] Commit `feat(mobile): qr my-code and scan-to-pay`.

### Task 9: Bills + recharge

**Files:** `app/bills/index.tsx` (biller grid by category), `app/bills/[billerId].tsx` (consumer no
→ lookup → bill card: name, month, due, amount) → pay → confirm flow. `app/recharge.tsx`
(telco grid, phone, amount presets 100/500/1000) → confirm flow.

- [ ] K-Electric `0400012345678` returns Ammi's ₨4,320 bill; pay completes; bill shows paid on re-lookup.
- [ ] Commit `feat(mobile): bills and recharge flows`.

### Task 10: Requests

**Files:** `app/requests/index.tsx` (incoming/outgoing list w/ status), `app/requests/new.tsx`
(contact/phone + amount + note); approve → confirm flow; decline.

- [ ] Commit `feat(mobile): money requests`.

### Task 11: More tab — pockets, card, statements, profile

**Files:** `app/(tabs)/more.tsx` (menu), `app/pockets/index.tsx` (+ progress bars),
`app/pockets/new.tsx`, deposit/withdraw amount sheets → confirm flow (no PIN),
`app/card.tsx` (virtual card: reveal PAN/CVV on tap, freeze toggle),
`app/statements/index.tsx` (year/month pick → generate → confirm dialog → summary card →
download button opens PDF via expo-sharing/WebBrowser), `app/profile.tsx` (user info,
**language toggle ur⇄en** — flips i18n + LTR, persisted).

- [ ] عمرہ فنڈ shows ₨1,20,000 / goal progress; deposit ₨2,000 works without PIN.
- [ ] Card reveals seeded PAN; freeze round-trips.
- [ ] Statement for last month generates and PDF opens.
- [ ] English toggle flips whole UI to LTR English.
- [ ] Commit `feat(mobile): pockets, card, statements, profile+language`.

### Task 12: Phase gate — Argent QA on both platforms

- [ ] Full manual-QA pass via Argent on iOS simulator AND Android emulator:
      login → balance → activity → send to Bilal (PIN) → bill pay → pocket deposit →
      card → statement → language toggle. Screenshots → `docs/qa/phase-3/`.
- [ ] All three test suites green. Roadmap Phase 3 → done. Commit `feat(mobile): phase 3 complete`.

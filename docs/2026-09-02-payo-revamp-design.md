# PAYO Revamp — Design Spec (v2, approved 2026-09-02)

**Status:** Approved by owner (design canvas v2). Supersedes the visual/auth/home sections of
`2026-09-01-payo-mvp-design.md`; everything not mentioned here (backend money engine,
pending-action gate, AI tools, contracts) stays as built.

**Visual source of truth:** `docs/design/revamp-v1/*.dc.html` (25 artboards; exact colors,
sizes, radii, copy) + `Foundations.dc.html` (tokens) + `Motion.dc.html` (motion spec).
Implementers copy values from these files, never approximate.

## 1. Product changes

1. **English-first.** UI language defaults to `en`; Urdu remains a full toggle (RTL, Nastaliq).
   The assistant understands English, Urdu, and Roman-Urdu code-mixing regardless of UI
   language, and replies in the UI language.
2. **AI-first Home.** The Home tab IS the assistant. On open it greets the user by name and
   offers five suggestion cards (send money, pay a bill — naming the actual due bill, check
   balance, top-up a phone, get a statement). Tapping a card sends that intent as a turn; the
   conversation continues in place. States: greet · listening · conversation (see artboards
   `Main`, `HomeListening`, `HomeConversation`).
3. **Tabs:** Home (assistant) · Wallet (balance card, quick actions, recent activity — the
   former dashboard) · Pay · More. The docked **AI bar** appears on Wallet/Pay/More and
   navigates to Home.
4. **Auth = phone only.** `Phone → OTP → (new user: Create PIN | returning: Enter PIN) → Home`.
   Unknown number creates the account on OTP request. No email, no signup screen. Name is
   optional and editable in Profile (defaults to "PAYO user" until set; seeded users keep names).
5. **Motion layer** per `Motion.dc.html` (13 moments) using Reanimated 4 + expo-haptics,
   honouring reduced motion (opacity-only, no loops).

## 2. Design system (from `Foundations.dc.html`)

- **Light (default):** bg `#F7F4EE`, surface `#FFFFFF`, surface2 `#F1EDE4`, separator
  `#E7E1D6`, ink `#0E2233`, ink2 `#5B6B78`, ink3 `#8A98A4`, amber `#F2A93B`, amberDeep
  `#D98F1F`, amberTint `#FBEBD0`, green `#1F9D6A`, greenTint `#DDF3E9`, red `#D64545`,
  redTint `#FBE3E3`, navy `#0D2A3D`.
- **Dark:** bg `#0B141C`, surface `#14202A`, surface2 `#1C2A35`, sep `#243441`, ink
  `#F3F6F8`, ink2 `#A7B4BF`, ink3 `#6F7E8A`, amber `#F5B34D`, amberDeep `#E19A2A`,
  amberTint `#3A2E19`, green `#3FC48A`, greenTint `#153826`, red `#F06A6A`, redTint
  `#3A1C1C`. Follows system appearance.
- **Type:** Plus Jakarta Sans (400/500/600/700/800) via `@expo-google-fonts/plus-jakarta-sans`;
  Noto Nastaliq Urdu for `ur`. Scale: money 40/48/800 tabular · h1 28/34/800 · h2 22/28/700 ·
  headline 17/22/600 · body 17/24/400 · sub 15/20/500 · foot 13/18/500 · cap 12/16/600 caps.
  Urdu line-heights ×1.9. Respect Dynamic Type (allowFontScaling, maxFontSizeMultiplier 1.6).
- **Shape/space:** radii card 20 · button 28 (pill) · input 16 · tile 18 · avatar circle.
  Spacing 4/8/12/16/20/24/32; screen gutter 20. Touch ≥44pt; primary buttons 56pt; keypad
  keys 64pt (72pt on PIN screens). Card shadow `0 8 24 rgba(14,34,51,.06)` light; none dark.
- **Icons:** `lucide-react-native`, 24px, stroke 2 (2.2 when emphasised). No emoji as icons.
- **Components (new `src/ui/`):** `Text` variants, `Button` (primary/secondary/ghost/danger),
  `Card`, `ListRow`, `Chip`, `Pill`, `Avatar`, `Input`, `Keypad`, `PinDots`, `TabBar`, `AIBar`,
  `Composer`, `BalanceCard`, `QuickAction`, `SuggestionCard`, `TxnRow`, chat `Bubble`, and the
  chat cards (`ConfirmationCard`, `BillCard`, `BalanceCard`, `TransactionsCard`,
  `StatementCard`, `ContactChips`, `PocketCard`, `SuccessCard`).

## 3. Backend contract changes (roadmap Contract 1 amendments)

| Route | Change |
|---|---|
| `POST /auth/request-otp` `{ phone }` | NEW. Creates the user (+account, card, welcome balance) if the phone is unknown. Returns `{ demoOtp, isNewUser }`. |
| `POST /auth/verify-otp` `{ phone, otp }` | CHANGED. Returns `{ otpToken, isNewUser, pinSet }`. `otpToken` is a JWT with `scope:'otp'`, 10-min expiry, accepted ONLY by `set-pin` / `verify-pin`. |
| `POST /auth/set-pin` `{ pin }` (otpToken) | NEW. Allowed only when `pinSet=false`. Sets PIN, returns `{ token, user }` (full session). |
| `POST /auth/verify-pin` `{ pin }` (otpToken OR session token) | CHANGED. With an otpToken: checks PIN, returns `{ token, user }`. With a session token: returns `{ valid: true }` (unchanged behaviour for in-app checks). |
| `POST /auth/signup`, `POST /auth/login` | REMOVED. |
| `PATCH /me` `{ name?, urduName?, language? }` | NEW. |
| `GET /bills/due` | NEW. `{ items: [{ billId, biller: {id,name,urduName,category}, consumerNo, amountPaisa, dueDate, month }] }` — bills with `status:'due'` linked to the user (`Bill.userId`, set on lookup and by seed). |
| `requireAuth` | Rejects tokens whose `scope` is `'otp'` (401 `OTP_SCOPE`). |

User model: `email` optional & no longer unique-required; `pinHash` optional; `pinSet:boolean`.
Seed: all six demo users have `pinSet:true`, PIN `1234`, phones `+92300111000{1..6}`.

## 4. AI service changes

- `/converse` unchanged in shape. System prompt: "understand English, Urdu (Nastaliq), and
  Roman Urdu; ALWAYS reply in `{language}`"; suggestion intents arrive as plain text turns
  (e.g. "I want to pay a bill"). New tool `list_due_bills` (→ `GET /bills/due`) so "pay a bill"
  resolves without asking for a consumer number when one is saved. Gemini audio path unchanged.
- No greeting endpoint: the greeting and suggestion cards are rendered client-side from `/me` +
  `/bills/due` (fast, no LLM cost).

## 5. Mobile architecture

- `app/(auth)/phone.tsx`, `otp.tsx`, `create-pin.tsx`, `enter-pin.tsx` replace login/signup/otp.
  Auth slice stores `{ token, user, otpToken? }`; the AuthGate routes: no token → phone; token →
  tabs. 401 sign-out guard stays.
- `app/(tabs)/index.tsx` = AI Home (uses `useConverse`, new `useHomeGreeting`), `wallet.tsx`,
  `pay.tsx`, `more.tsx`; `activity.tsx` moves to `app/activity.tsx` (reached from Wallet "See all").
- Theme: `src/theme/tokens.ts` → light/dark token sets + `useTheme()` (system appearance).
  NativeWind stays available but components use tokens directly.
- i18n default `en`; `ur` toggle in More → Profile; RTL handled as today (per-layout).
- Motion: `src/motion/` — `useRise(delay)`, `usePressScale()`, `Breathe`, `ListeningRings`,
  `TypingDots`, `useCountUp`, `useShake`, all gated by `useReducedMotion()`.

## 6. Out of scope

Real SMS, biometrics, notifications, Android-specific polish beyond parity, web.

## 7. Acceptance (demo on simulator, both platforms where feasible)

1. Fresh install → phone → OTP (demo code shown) → Create PIN → Home greets "PAYO user".
2. Seeded امی: phone → OTP → Enter PIN → Home greets "Ammi Jaan"; "Pay a bill" card names
   K-Electric ₨4,320; tapping it → assistant bill card → Yes → PIN → success → Wallet balance
   updated.
3. Typed "Bilal ko 1500 rupees bhejo" (Roman Urdu) with UI in English → English reply +
   confirmation card → PIN → success. Same with UI in Urdu → Urdu reply.
4. Dark mode follows system; Urdu toggle flips UI and reply language.
5. Motion: greeting rise + card stagger on Home open; mic breathing; listening rings; thinking
   dots; PIN dot fill; wrong-PIN shake; success check-then-text; reduced motion disables loops.
6. All suites green; Argent screenshots for 1–5 in `docs/qa/revamp/`.

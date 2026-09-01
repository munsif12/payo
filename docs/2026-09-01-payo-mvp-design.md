# PAYO — AI-First Banking MVP — Design Spec

**Date:** 2026-09-01
**Status:** Awaiting final review
**Audience:** VC demo MVP — no real money movement, no payment gateways.

---

## 1. Product concept

PAYO is an **AI-first, voice-first banking app for non-tech Urdu-speaking users**. The
primary interface is a spoken conversation in Urdu: the user taps a mic, says what they
want ("بجلی کا بل ادا کرنا ہے", "بھائی کو میزان اکاؤنٹ پر پیسے بھیجو"), and the AI agent
understands, gathers what's missing, and executes — always behind a
speak-aloud → tap-confirm → PIN safety gate for anything that moves money.

The **second layer** is a classic tab-based wallet UI (inspired by Easypaisa / JazzCash /
SadaPay / Stable) so every AI capability is also doable by hand.

**Design principle for every screen:** one big obvious thing to do, large type, spoken
feedback for everything the AI does.

## 2. Personas

- **Primary:** older / non-tech Urdu speaker (the "امی" persona). Can speak, can tap big
  buttons, may not read English, knows WhatsApp voice notes.
- **Secondary:** ordinary wallet user using the classic layer.
- **Demo audience:** VCs — English toggle exists so comprehension can be shown to
  non-Urdu speakers.

## 3. Scope

### In scope (MVP)

| Area | Features |
|---|---|
| Auth | Signup/login: email + 4-digit PIN, mock OTP screen (code displayed on-screen) |
| Core wallet | Balance (hidden by default, tap/ask to reveal), transaction history w/ filters, profile |
| Send money | Payo→Payo P2P; "other bank" via fake Raast/IBAN directory (HBL, Meezan, UBL…) with account-title lookup that resolves the recipient's name before confirm |
| Request money | Ask a contact to pay; they approve in-app |
| Bills & recharge | Fake biller catalog (K-Electric, PTCL, SSGC…), mobile top-up (Jazz, Zong, Telenor, Ufone) |
| E-statements | Monthly/yearly statement generation; confirm dialog → view + big download button (PDF) |
| QR | Scan-to-pay + "my QR" to receive |
| Savings pockets | Named sub-balances with goals & progress ("عمرہ فنڈ"); AI can create/deposit |
| Virtual card | Display-only debit card: number/CVV reveal, freeze toggle |
| AI layer | Voice-first Urdu agent that can do ALL of the above (except QR scan, which is camera-driven) |
| Language | Urdu-first UI (RTL, Noto Nastaliq), settings toggle → English (UI + AI voice) |
| Currency | PKR (₨) throughout |

### Out of scope

Real payment gateways/rails, KYC, push notifications, multi-currency, store builds,
production hardening (rate limiting/HMAC — JWT auth only), web app, real SMS OTP.

## 4. Architecture

```
┌────────────────────────────────┐
│  apps/mobile (Expo RN + TS)    │  voice home + classic tabs
└──────┬─────────────────┬───────┘
       │ REST (JWT)      │ REST + SSE, audio up/down (JWT pass-through)
┌──────▼───────┐   ┌─────▼─────────────┐
│ services/    │◄──┤ services/ai        │
│ backend      │   │ Python 3.12 FastAPI│
│ Node+Express │   │ LangGraph + Gemini │
│ +Mongoose    │   │ + Cartesia TTS     │
└──────┬───────┘   └───────────────────┘
       │
┌──────▼────────┐
│ local MongoDB │  (docker-compose)
└───────────────┘
```

**Rule: the AI is just another client.** The AI service calls the Node backend's REST
APIs, forwarding the user's JWT. It has no DB access and no privileged path — every
action goes through the same validated, ownership-checked API the app uses. (This is
the deliberate divergence from SIA, which is read-only and DB-direct; PAYO's AI
*executes*, so it must go through the API.)

### Voice pipeline

```
🎤 tap → record → silence auto-stop (VAD)
 → POST audio to services/ai
 → Gemini native audio: understands Urdu + Urdu/English code-mixing directly
   (no lossy STT hop; input stage is behind an interface so ElevenLabs Scribe
   can be swapped in if Urdu accuracy disappoints in testing)
 → LangGraph agent runs tools against the backend
 → Urdu reply text + structured UI cards
 → Cartesia Sonic-3.6 TTS (Urdu, low latency) → 🔊 played back
```

- Text chat remains available as a fallback input on the same screen.
- SSE streaming for text; TTS audio returned per-utterance.
- Keys: Gemini reused from SIA's `.env` (local dev only, never committed); Cartesia key
  provided by the owner at Phase 4.

### Confirm-before-execute (the money safety gate)

Write tools (`send_money`, `pay_bill`, `recharge`, `pocket_deposit`, …) never execute.
They create a **PendingAction** via the backend (recipient, amount, fee, expiry ~2 min)
and return a `confirmation_card` the app renders natively. Then:

1. App **speaks the confirmation aloud in Urdu** ("آپ بلال کو ₨1,500 بھیج رہے ہیں…")
   and shows a large card (photo, name, bank/account, amount, fee).
2. User taps the big **تصدیق** button.
3. **PIN pad appears — user re-enters their 4-digit PIN.**
4. `POST /actions/:id/execute` (user's JWT + PIN) performs the transfer atomically.
5. Spoken + visual success.

The human tap + PIN — not the LLM — is what moves money. Mishearing is harmless.
Read-only actions (balance, transactions, statements) skip the PIN but still confirm
where sensible (e.g. statement year confirm dialog → download button).

## 5. Monorepo layout — `~/work/payo/`

```
payo/
├── apps/mobile/          # Expo + RN + TS, Expo Router, RTK Query, NativeWind, i18n (ur/en, RTL)
├── services/backend/     # Node + Express + Mongoose — Stable backend conventions:
│                         #   controller-owns-logic, ApiError, standard response shape,
│                         #   Mongo sessions for multi-doc writes
├── services/ai/          # Python 3.12 + FastAPI + LangGraph + Gemini + Cartesia, uv-managed
├── docs/                 # this spec, implementation plan, demo script
├── docker-compose.yml    # mongo
└── README.md
```

## 6. Data model (Mongo, DB `payo`)

- `users` — name, urduName, email, phone, PIN hash, avatar, language pref
- `accounts` — one PKR wallet per user; balance; also backs pockets via `type`
- `pockets` — name, goal amount, balance, emoji/icon, owner
- `transactions` — double-entry-lite: type (p2p / bank_transfer / bill / recharge /
  pocket / request_settlement), amount, fee, counterparty (user or fake bank
  account), category, status, ref no., timestamps
- `contacts` — saved payees: payo users + external bank accounts (bank, IBAN, title)
- `banks` — fake directory (name, urduName, logo) for the "other bank" flow
- `billers` + `bill_payments` — categories, fake account-number lookup returning a due bill
- `telcos` + `recharges`
- `money_requests` — requester, payee, amount, note, status
- `cards` — one virtual debit card per user: PAN (fake), CVV, expiry, frozen flag
- `statements` — generated monthly/yearly summaries + rendered PDF
- `pending_actions` — the confirm-before-execute queue (expiring)
- `chat_sessions` + `chat_messages` — history incl. structured card payloads
- `otp_codes` — mock OTP (also displayed on screen)

**Money invariants (tested):** balance never negative; every transaction has matched
debit/credit entries; pending action executes at most once (idempotent execute);
expired actions can't execute; PIN required on execute of money-moving actions.

Seed script: ~6 demo users with Urdu names (بلال، سارہ، امی…), 3 months of realistic
transaction history, contacts, one pocket each, a due electricity bill, so statements
and "پچھلے مہینے کھانے پر کتنا خرچ ہوا؟" queries look real.

## 7. Backend API surface (summary)

`/auth` (signup, login, otp/verify, pin/verify) · `/me` · `/accounts` (balance) ·
`/transactions` (list, filters, spending-summary) · `/contacts` · `/banks`
(+ `/banks/resolve-title`) · `/transfers` (create-pending) · `/bills` (billers, lookup,
pay-pending) · `/recharges` · `/requests` (create, approve → pending) · `/pockets`
(CRUD, deposit/withdraw-pending) · `/cards` (get, freeze) · `/statements` (generate,
download PDF) · `/qr` (my-qr payload, resolve scanned payload) ·
`/actions/:id/execute|cancel` · `/chat` (sessions, messages — persisted by the AI
service through this API).

All money-moving endpoints follow: create pending → execute with PIN. Standard
response shape and `ApiError` per Stable conventions.

## 8. AI agent (services/ai)

Single LangGraph agent, Gemini model, system prompt in Urdu-first persona (polite,
simple sentences, never reads full card numbers aloud).

- **Read tools:** `get_balance`, `list_transactions`, `spending_summary`,
  `get_statement`, `search_contacts`, `list_billers`, `lookup_bill`, `list_pockets`,
  `get_card_status`, `list_requests`
- **Write tools (→ pending action):** `send_money` (P2P or bank via title-resolve),
  `pay_bill`, `recharge`, `create_pocket`, `pocket_deposit`, `request_money`,
  `freeze_card`
- **Disambiguation:** two Sarahs → agent asks, returning tappable `contact_chips`.
- **Structured outputs:** every reply = Urdu text + optional typed card:
  `confirmation_card`, `transaction_list`, `statement_card` (with download),
  `contact_chips`, `bill_card`, `pocket_card`, `success_card`. The app renders these
  natively — the demo feels like a product, not a chatbot.
- Endpoints: `POST /converse` (audio or text in; SSE out: transcript-echo, text
  tokens, cards, TTS audio ref), `GET /tts/:id` (audio bytes).

## 9. Mobile app

### Layer 1 — voice home (default screen)

Giant center mic button (tap → speak → auto-stop). Above it, the conversation
transcript with rich cards. Below/around: 3–4 large suggestion tiles with icons
("بل ادا کریں", "پیسے بھیجیں", "گوشوارہ", "بچت"). Balance in header, hidden behind a
tap (privacy). Keyboard icon for typed fallback.

### Layer 2 — classic tabs

- **ہوم** (voice screen above)
- **سرگرمی** — transactions with filters + search; tap → receipt view (shareable)
- **ادائیگی** — send money (Payo / other bank), QR scan & my QR, bills, recharge,
  requests
- **مزید** — pockets, virtual card, statements, profile, language toggle, settings

### Design direction

Dark-first fintech look: deep ink background, electric-mint accent, very large
numerals for money, soft cards, generous spacing; light mode supported. Urdu
typography via Noto Nastaliq Urdu with full RTL; English mode flips to LTR.
Elder-friendly sizing: min 18pt body, 56pt touch targets on primary actions.
A small design-token system first; early screens shown for feedback before rolling
across the app.

## 10. Testing & verification

- **Backend:** unit + integration tests (money invariants above, auth, pending-action
  lifecycle, statement generation).
- **AI service:** pytest on tool contracts + a fake-LLM harness for the graph;
  golden-file tests for card payload shapes.
- **Mobile:** driven end-to-end on **iOS simulator + Android emulator via Argent**
  after each phase — screenshots as proof; final full demo-script run (voice → send
  money → PIN → balance updated → Activity shows it → statement download) on both
  platforms before done.

## 11. Build phases (each demoable)

1. **Scaffold + infra** — monorepo, docker-compose Mongo, Expo app boots, backend
   & AI service hello-world, seed script, dev scripts, design tokens + Urdu/RTL i18n
   foundation.
2. **Backend core** — auth/OTP/PIN, accounts, transactions, contacts, banks,
   transfers, pending-actions engine, bills, recharges, pockets, requests, cards,
   statements (+ tests).
3. **Mobile classic layer** — auth flow, tabs, Activity, full Pay flows (send, QR,
   bills, recharge, requests), pockets, card, statements — all manual, against the
   real backend.
4. **AI service** — LangGraph agent + tools + Gemini audio in + Cartesia TTS out +
   SSE. (Cartesia key needed here.)
5. **Voice home** — mic UX, transcript + rich cards, spoken confirmation + PIN gate,
   suggestion tiles.
6. **Polish + demo pass** — statement PDFs, seed realism, design polish, English
   toggle QA, full Argent QA on both platforms, bilingual demo script doc.

## 12. Risks & mitigations

- **Urdu STT quality** → Gemini native audio chosen precisely for this; input stage
  abstracted so ElevenLabs Scribe can substitute; test with real Urdu audio early
  in Phase 4.
- **Cartesia Urdu is beta (Sonic-3.6, Aug 2026)** → verify voice quality at Phase 4
  start; fallback = ElevenLabs v3 Urdu.
- **RTL/Nastaliq rendering quirks in RN** → i18n + RTL built in Phase 1, not
  retrofitted; verified on both platforms early.
- **Demo-day network dependence (Gemini/Cartesia are cloud APIs)** → demo script
  includes a canned-responses offline mode flag as a safety net (stretch, Phase 6).

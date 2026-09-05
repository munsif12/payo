# PAYO MVP — Master Roadmap & Cross-Service Contracts

> **For agentic workers:** This is the index plan. Execute phases in order via their
> per-phase plan files (checkbox tasks live there). REQUIRED SUB-SKILL for executing a
> phase plan: superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans.

**Goal:** Voice-first Urdu banking MVP (PAYO) — 3 services + seeded local Mongo, demoable on iOS simulator + Android emulator.

**Spec:** `docs/2026-09-01-payo-mvp-design.md` (approved 2026-09-01). The spec is the
source of truth for product behavior; this roadmap is the source of truth for
**cross-service contracts** — any change to a contract here must be reflected in every
phase plan that consumes it.

**Architecture:** Expo RN app → Node/Express/Mongoose backend (all business logic, all
money movement) ← Python FastAPI AI service (LangGraph + Gemini audio-in, Cartesia
TTS-out) which calls the backend's REST API with the user's JWT. AI is "just another
client" — no DB access, no privileged path. Money moves only via
pending-action → confirm → PIN → execute.

**Tech Stack:** Node 20+ / Express 4 / Mongoose 8 / TypeScript / jest + supertest +
mongodb-memory-server(ReplSet) · Python 3.12 / FastAPI / LangGraph / google-genai /
Cartesia / uv / pytest · Expo (latest SDK) / TypeScript / expo-router / RTK Query /
NativeWind / i18next (ur default, RTL) · MongoDB 7 in docker-compose as single-node
replica set (required for multi-doc transactions).

## Phase index

| # | Phase | Plan file | Status |
|---|-------|-----------|--------|
| 1 | Scaffold + infra | `plans/2026-09-01-phase-1-scaffold.md` | done |
| 2 | Backend core | `plans/2026-09-01-phase-2-backend-core.md` | done |
| 3 | Mobile classic layer | `plans/2026-09-01-phase-3-mobile-classic.md` | done |
| 4 | AI service (voice loop) | `plans/2026-09-02-phase-4-ai-service.md` | done |
| 5 | Voice home + confirmation gate | `plans/2026-09-02-phase-5-voice-home.md` | done |
| 6 | Polish + demo pass | `plans/2026-09-02-phase-6-polish-demo.md` | done |
| R1–R7 | Revamp v2 (AI-first Home, phone auth, new design system) | `plans/2026-09-02-revamp-plan.md` | done 2026-09-03 |
| V1–V5 | v3 — bank-aware sends, saved recipients, in-chat PIN, biller flow, Urdu fixes | `plans/2026-09-03-v3-plan.md` | done 2026-09-03 |

Just-in-time plans MUST be written with the writing-plans skill, argue from this
roadmap's contracts, and be saved next to the two existing phase plans before any code
for that phase is written.

## Global constraints (apply to every task in every phase plan)

- **Money is integer paisa** (₨1 = 100 paisa) everywhere — DB, API, AI tools. Only the
  mobile formatting helper converts to display ("₨1,500"). No floats, ever.
- **Currency:** PKR only.
- **Standard API response shape:** success `{ "success": true, "data": <payload> }`;
  error `{ "success": false, "message": string, "code": string }` (HTTP status set
  accordingly). Thrown as `ApiError(status, code, message)`.
- **Auth:** `Authorization: Bearer <JWT>` on every route except `/auth/*` and
  `/health`. JWT payload: `{ sub: <userId>, email?, scope: 'session' | 'otp' }`, HS256,
  `JWT_SECRET` env. `requireAuth` rejects `scope:'otp'` tokens (401 `OTP_SCOPE`).
- **Multi-document writes use Mongoose sessions** (`withTransaction`). Mongo must run
  as a replica set (docker-compose handles it; tests use `MongoMemoryReplSet`).
- **Money-moving endpoints never execute directly.** They create a `PendingAction`;
  execution happens only at `POST /actions/:id/execute` with a valid PIN.
- **Backend conventions:** controller-owns-logic (no service layer), thin routes,
  zod validation at route entry, `ApiError` for all failures, jest tests colocated
  under `src/**/__tests__/`.
- **Ports (dev):** backend `4000`, AI service `8000`, Metro `8081`, Mongo `27018` (changed from 27017: dev machines often run a local standalone mongod on the default port, which would shadow the replica set).
- **Env files:** each service has `.env` (gitignored) + `.env.example` (committed).
  Gemini key copied from SIA's local `.env` (`GEMINI_API_KEY`); Cartesia key
  (`CARTESIA_API_KEY`) provided by owner at Phase 4. Never commit keys.
- **Language:** all user-facing strings bilingual `ur`/`en`, Urdu default. Backend
  stores/returns i18n keys or both-language fields (see contracts), never bakes a
  single language into data.
- **Naming:** product name is **PAYO** (all caps) in UI copy; package scope `payo-*`.

## Contract 1 — Backend REST API (consumed by mobile + AI service)

Base URL `http://localhost:4000/api/v1`. All amounts integer paisa. `id` fields are
Mongo ObjectId strings. Routes marked 🔒 require JWT.

**Auth is phone-only** (`Phone → OTP → Create PIN | Enter PIN`, see revamp design spec §3).
`signup`/`login` (email+password) are removed. `requireAuth` rejects otp-scope tokens
with 401 `OTP_SCOPE`.

| Method & path | Body (zod-validated) → `data` payload |
|---|---|
| `POST /auth/request-otp` | `{ phone }` → `{ demoOtp, isNewUser }`. Creates the user (+account with welcome balance, +card) in one transaction if the phone is unknown; name defaults to "PAYO user". Always (re)issues a fresh demo OTP, 5-min expiry. |
| `POST /auth/verify-otp` | `{ phone, otp }` → `{ otpToken, isNewUser, pinSet }`. Max 5 wrong attempts → 429 `OTP_LOCKED`; wrong/expired → 400 `INVALID_OTP`. `otpToken` is a 10-min JWT, `scope:'otp'`, accepted only by `set-pin`/`verify-pin`. |
| `POST /auth/set-pin` *(otpToken)* | `{ pin(4 digits) }` → `{ token, user }` (full session). 409 `PIN_ALREADY_SET` if the user already has a PIN. |
| 🔒\* `POST /auth/verify-pin` | `{ pin }` → with an **otpToken**: `{ token, user }` (completes login) or 401 `INVALID_PIN`; with a **session token**: `{ valid: true }` (unchanged in-app re-check) or 401 `INVALID_PIN`. \*accepts otp-scope OR session-scope token. |
| 🔒 `GET /me` | → `{ user: { id, name, urduName?, email?, phone, avatar?, language, pinSet, preferences: { proactiveGreeting }, guardian?: { name, phone } }, account: { id, balancePaisa }, card: { id, last4, frozen } }` — the guardian summary is name+phone only; no ids leak to the payer. |
| 🔒 `PATCH /me` | `{ name?, urduName?, language?, preferences?: { proactiveGreeting? } }` → updated `user` (partial update). |
| 🔒 `GET /me/digest?ack=1` | → `{ items: DigestItem[], since }`. Items since `lastDigestAt` (or the last 7 days if never seen), approvals first: `received` (incoming completed txns), `bill_due` (refreshed like `/bills/due`), `approval_waiting` (as guardian), `request` (pending incoming money requests), `anomaly` (at most one — the out-category whose month-to-date total most exceeds 1.5× its previous-3-month average), `guardian_notice` (change `remove`|`replace`|`raise`|`reminder`). The anomaly's baseline window ends EXCLUSIVELY at the start of this month, so a transaction on the boundary is not counted in both. `?ack=1` stamps `lastDigestAt` — including when the greeting is off, so turning it back on does not replay a week of stale items. `{ items: [] }` when `preferences.proactiveGreeting` is false. |
| 🔒 `GET /transactions?type&category&from&to&q&limit&cursor` | → `{ items: Txn[], nextCursor }`. `q` case-insensitively substring-matches `counterparty.name`, `counterparty.urduName`, `counterparty.detail`, `refNo` (regex-escaped); composes with the other filters. |
| 🔒 `GET /transactions/:id` | → `Txn` (same DTO as the list), own transaction only — 404 `NOT_FOUND` otherwise, 400 `INVALID_ID` if `:id` isn't a valid ObjectId. |
| 🔒 `GET /transactions/spending-summary?from&to` | → `{ totalOutPaisa, totalInPaisa, byCategory: [{ category, totalPaisa, count }] }` |
| 🔒 `GET /institutions?q=` | → `{ items: [{ id, name, urduName, kind: 'wallet'\|'bank', code, popular }] }` — ~35 entries (5 wallets: PAYO, Easypaisa, JazzCash, SadaPay, NayaPay; ~30 banks); `q` matches name/urduName/code; popular first, then alphabetical. |
| 🔒 `POST /transfers/resolve` | `{ institutionId, identifier }` → `{ title, institution: {id,name,urduName,kind}, identifier, linkedUserId? }`. PAYO + phone → real user (404 `RECIPIENT_NOT_FOUND`, 400 `SELF_TRANSFER`); other wallets → phone normalised to `+92…`, deterministic title; banks → IBAN or 10–16 digit account no, deterministic title; else 400 `INVALID_IDENTIFIER`. |
| 🔒 `GET /recipients?q=` / `POST /recipients` / `DELETE /recipients/:id` | create: `{ nickname, institutionId, identifier }` → resolves + stores `{ id, nickname, title, institution: {id,name,urduName,kind}, identifier, linkedUserId?, lastUsedAt }`; `q` matches nickname/title/identifier; list is most-recently-used first; duplicate `(userId, institutionId, identifier)` → 409 `ALREADY_SAVED`. Replaces `Contact`/`/contacts`. |
| 🔒 `POST /transfers` | `{ to: { recipientId } \| { institutionId, identifier }, amountPaisa, note?, riskFlags?: ['pressure_language'] }` → `PendingAction` (resolves again server-side; fee: banks 2500, wallets 0). Legacy `phone`/`bank`/`contact` shapes and `/banks*` are removed. **Guardian/scam evaluation:** the backend adds `new_recipient_large` when the recipient is new AND (`amountPaisa` ≥ 25 % of balance OR ≥ 2000000); `needsApproval = guardian set && (newRecipient \|\| amountPaisa ≥ ceilingPaisa \|\| riskFlags.length)` → `approval: { required: true, guardianId, status: 'waiting' }`. `expiresAt` is 30 min when an approval or a risk flag applies, else the usual 2 min. **New recipient** = no `PendingAction` of a paying kind (`send_money*` or `request_settlement`) with `status: 'completed'` whose payload matches this `institutionId` + `identifier` — so a saved-but-never-paid recipient is still new. |
| 🔒 `GET /guardian` | → `{ guardian: { userId, phone, name, ceilingPaisa, since } \| null, pending: { change: 'remove'\|'raise', ceilingPaisa?, effectiveAt } \| null, ceilingPaisa, coolingMs }`. A due `guardianPending` is applied lazily on this read (and on `GET /me` and transfer evaluation) — there is no cron. Default `ceilingPaisa` 10000000 (₨1,00,000). |
| 🔒 `PUT /guardian` | `{ phone, pin }` → guardian state. A FIRST nomination is tightening, so instant; re-nominating the SAME person is also instant and cancels a scheduled removal. REPLACING a live guardian is a loosening (an instant swap to a colluding account would defeat the feature): it is scheduled like a removal (`guardianPending.change: 'replace'`, carrying the incoming `phone`/`name`), the outgoing guardian keeps authority until it is due, and they are noticed. Payer's PIN via `assertPinOk`. 404 `USER_NOT_FOUND`, 400 `SELF_GUARDIAN`, 401 `INVALID_PIN`. |
| 🔒 `DELETE /guardian` | `{ pin }` → guardian state. Loosening: scheduled at `now + GUARDIAN_COOLING_MS` (env, default 86400000; `.env.example` 0 for the demo) and applied immediately when that is 0. While cooling, the OLD rule still applies. Raises a `GuardianNotice` for the guardian. 404 `NO_GUARDIAN`. |
| 🔒 `PATCH /guardian/ceiling` | `{ ceilingPaisa, pin }` → guardian state. Lowering (or equal) is instant; raising is scheduled like a removal and notices the guardian. 404 `NO_GUARDIAN`. |
| 🔒 `GET /approvals` | → `{ items: [ApprovalItem] }` where `ApprovalItem` is `{ id, kind, payer: { name, urduName?, phone }, summary, amountPaisa, feePaisa, riskFlags, status, approval: { status, decidedAt, reason, remindedAt }, createdAt, expiresAt }` — waiting, unexpired actions belonging to the payers whose CURRENT guardian is me, newest first. The action payload, lines and the payer's `requiresPin` are never exposed to the guardian. |
| 🔒 `POST /approvals/:id/approve` | `{ pin }` → `ApprovalItem` with `approval.status: 'approved'`. The GUARDIAN's own PIN via the shared `assertPinOk` (same lockout as their login). **Authority is the payer's CURRENT guardian** (pending cooling settled first), never the `approval.guardianId` snapshot — a guardian since removed or replaced gets 404, and the incoming one can decide instead (spec §A.6a). The payer gets 404 too; already decided/expired → 410 `ACTION_GONE`. Approval lifts only the guardian gate: the payer still enters their own PIN at execute. |
| 🔒 `POST /approvals/:id/decline` | `{ reason? }` → `ApprovalItem` with `approval.status: 'declined'`, `status: 'cancelled'`, `cancelReason: 'guardian_declined'`. Same current-guardian authority rule. No PIN. |
| 🔒 `GET /actions/:id` | → the caller's own `PendingAction` DTO (for polling while a guardian decides). 404 for anyone else. |
| 🔒 `POST /actions/:id/check-in` | `{ someoneAsked }` → the action DTO. Records `checkIn: { answered: true, someoneAsked }`; `true` also cancels the action with `cancelReason: 'scam_checkin'`. 410 once the action is gone. |
| 🔒 `POST /actions/:id/remind` | → `{ reminded: true, action }`; sets `approval.remindedAt` and raises a `guardian_notice` of change `reminder` (carrying `actionId`) so the nudge actually surfaces in the guardian's digest. 429 `REMIND_TOO_SOON` within 60 s of the last one, 409 `NOT_WAITING` if no approval is pending. |
| 🔒 `GET /billers` | → `{ items: [{ id, name, urduName, category }] }` (categories: electricity, gas, internet, water, mobile) |
| 🔒 `GET /bills/due` | → `{ items: [{ billId, biller: {id,name,urduName,category}, consumerNo, amountPaisa, dueDate, month }] }` — the caller's own due bills (`Bill.userId`, stamped on lookup and by seed), refreshed to also include each saved biller's current due bill. |
| 🔒 `POST /bills/lookup` | `{ billerId, consumerNo }` → `{ billId, consumerName, amountPaisa, dueDate, month }` (deterministic fake; stamps `bill.userId` to the caller) |
| 🔒 `POST /bills/pay` | `{ billId }` → `PendingAction` |
| 🔒 `GET /saved-billers` / `POST /saved-billers` / `DELETE /saved-billers/:id` | create: `{ nickname, billerId, consumerNo }` → does the lookup and stores `{ id, nickname, biller: {id,name,urduName,category}, consumerNo, consumerName }`; duplicate `(userId, billerId, consumerNo)` → 409 `ALREADY_SAVED`. |
| 🔒 `GET /telcos` | → `{ items: [{ id, name, urduName }] }` (Jazz, Zong, Telenor, Ufone) |
| 🔒 `POST /recharges` | `{ telcoId, phone, amountPaisa }` → `PendingAction` |
| 🔒 `GET /requests` / `POST /requests` | create: `{ fromPhone, amountPaisa, note? }`; incoming request approve: `POST /requests/:id/approve` → `PendingAction` (payer side); `POST /requests/:id/decline`. **Settling a request is an outgoing money path and runs the SAME guardian/scam evaluation as `POST /transfers`** (spec §A.6a): the recipient is the requester's PAYO identity (institution PAYO + their phone), which the payload also records — so a completed settlement and a completed transfer each make the other "not a new recipient". |
| 🔒 `GET /pockets` / `POST /pockets` | create: `{ name, urduName?, emoji, goalPaisa? }` → `Pocket` |
| 🔒 `POST /pockets/:id/deposit` / `.../withdraw` | `{ amountPaisa }` → `PendingAction` |
| 🔒 `GET /cards/mine` | → full card `{ id, pan, cvv, expiry, frozen, last4, maskedPan }` (display-only fake; `last4` is `pan`'s last 4 digits, `maskedPan` is `•••• •••• •••• 1234`) |
| 🔒 `POST /cards/mine/freeze` | `{ frozen: true }` only (any other body → 400) → `Card`. Instant, no PIN. |
| 🔒 `POST /cards/mine/unfreeze` | → `PendingAction` (`kind: 'card_unfreeze'`, `requiresPin: true`, `amountPaisa: 0`); executor sets `frozen: false`. 409 `CARD_NOT_FROZEN` if the card is already unfrozen. |
| 🔒 `POST /statements` | `{ year, month? }` (month omitted = yearly) → `{ statementId, summary }` |
| 🔒 `GET /statements` | → `{ items: StatementMeta[] }` |
| 🔒 `GET /statements/:id/pdf` | → `application/pdf` bytes |
| 🔒 `GET /qr/mine` | → `{ payload }` (signed string encoding userId+phone) |
| 🔒 `POST /qr/resolve` | `{ payload }` → `{ user: { name, urduName, phone, avatar } }` |
| 🔒 `POST /actions/:id/execute` | Gates, in order, before the PIN: 410 `ACTION_GONE` (expired/cancelled — including after a guardian decline or a "yes" check-in), 403 `APPROVAL_REQUIRED` while `approval.status` is `waiting`, 403 `CHECKIN_REQUIRED` while `riskFlags` is non-empty and no check-in has been answered. `{ pin }` → `{ transaction: Txn \| null, recipientSuggestion?: { institutionId, identifier, title, alreadySaved }, billerSuggestion?: { billerId, consumerNo, consumerName, alreadySaved }, card?: { last4, maskedPan, expiry, frozen } }` (atomic; idempotent; 410 if expired/consumed; `recipientSuggestion` on `send_money*` kinds, `billerSuggestion` on `pay_bill`; `transaction` is `null` for non-money kinds — currently `card_unfreeze`, which returns `card` instead, the `GET /cards/mine` DTO minus `pan`/`cvv`) |
| 🔒 `POST /actions/:id/cancel` | → `{ cancelled: true }` |
| 🔒 `GET /chat/sessions` / `POST /chat/sessions` → `Session`; `GET /chat/sessions/:id/messages`; `POST /chat/sessions/:id/messages` `{ role, text, cards? }` → `Message` (written by AI service) |

**`Txn` shape:** `{ id, type: 'p2p'|'bank_transfer'|'bill'|'recharge'|'pocket_deposit'|'pocket_withdraw'|'request_settlement'|'card_unfreeze', direction: 'in'|'out', amountPaisa, feePaisa, counterparty: { name, urduName?, detail }, category, status: 'completed', refNo, createdAt }`

**`PendingAction` shape (the confirmation contract):**
```json
{
  "id": "…", "kind": "send_money|pay_bill|recharge|pocket_deposit|pocket_withdraw|request_settlement",
  "amountPaisa": 150000, "feePaisa": 2500,
  "summary": { "en": "Send ₨1,500 to Bilal Ahmed", "ur": "بلال احمد کو ₨1,500 بھیجیں" },
  "lines": [ { "label": {"en":"To","ur":"وصول کنندہ"}, "value": "Bilal Ahmed · Meezan ****1234" } ],
  "requiresPin": true, "expiresAt": "ISO", "status": "pending", "cancelReason": null,
  "approval": null,
  "riskFlags": [],
  "checkIn": null
}
```

`approval`, when present: `{ required: true, guardianId, status: 'waiting'|'approved'|'declined',
decidedAt, reason, remindedAt }` (nulls where undecided). `riskFlags` ⊆
`['pressure_language', 'new_recipient_large']`. `checkIn`, when answered:
`{ answered: true, someoneAsked }`. `cancelReason` is `'scam_checkin' | 'guardian_declined'`.

**Fees:** P2P/pockets/requests = 0; bank_transfer = ₨25 (2500); bill = 0; recharge = 0.
Fee table lives in one backend config module.

## Contract 2 — AI conversation protocol (mobile ↔ AI service)

`POST http://localhost:8000/converse` — multipart (`audio` file m4a/wav) or JSON
(`{ text }`), plus `{ sessionId?, language: 'ur'|'en' }`; header `Authorization:
Bearer <same backend JWT>` (AI forwards it to the backend verbatim).

Response is **SSE** (`text/event-stream`), events in order:

| event | data |
|---|---|
| `transcript` | `{ text }` — what Gemini heard (display above reply) |
| `token` | `{ text }` — reply text delta (Urdu or English per `language`) |
| `card` | one `Card` JSON (schema below) |
| `audio` | `{ url }` — fetchable TTS mp3 for the full reply (`GET /tts/:id`) |
| `done` | `{ sessionId, messageId }` |
| `error` | `{ message, code }` |

## Contract 3 — Card schemas (rendered natively by mobile; produced by AI service; `confirmation` mirrors backend PendingAction)

```ts
type Card =
  | { kind: 'confirmation'; actionId: string; summary: { en: string; ur: string };
      lines: { label: { en: string; ur: string }; value: string }[];
      amountPaisa: number; feePaisa: number; requiresPin: boolean; expiresAt: string }
  | { kind: 'success'; title: { en: string; ur: string }; refNo: string; amountPaisa: number }
  | { kind: 'transactions'; items: Txn[] }                     // Txn from Contract 1
  | { kind: 'statement'; statementId: string; period: { en: string; ur: string };
      totalInPaisa: number; totalOutPaisa: number; downloadUrl: string }
  | { kind: 'contact_chips'; prompt: { en: string; ur: string };
      contacts: { contactId: string; name: string; urduName?: string; detail: string }[] }
  | { kind: 'bill'; billId: string; biller: string; consumerName: string;
      amountPaisa: number; dueDate: string; month: string }
  | { kind: 'pocket'; pocketId: string; name: string; urduName?: string; emoji: string;
      balancePaisa: number; goalPaisa?: number }
  | { kind: 'balance'; balancePaisa: number };
```

Card taps → app behavior: `confirmation` → speak summary aloud + تصدیق button → PIN pad
→ `POST /actions/:id/execute`; `contact_chips` tap → sends chip text back into
`/converse` as text turn; `statement` → download button hits `downloadUrl`.

## Contract 4 — Seeded demo world (Phase 2 seed script; all phases rely on it)

- Users (PIN `1234` for all): **امی / Ammi Jaan** (`ammi@payo.demo`, the primary demo
  persona, ₨84,500), **بلال احمد / Bilal Ahmed** (`bilal@payo.demo`), **سارہ خان /
  Sara Khan**, **سارہ ملک / Sara Malik** (duplicate-first-name for disambiguation
  demo), **حمزہ / Hamza**, **عائشہ / Ayesha**. Phones `+9230011100 01–06`.
- 3 months of history each (salaries in, groceries/food/transport/bills out, some P2P
  between them) so spending-summary and statements look real.
- Banks: HBL, Meezan, UBL, MCB, Allied. Billers: K-Electric, SSGC, PTCL, Karachi
  Water. Telcos: Jazz, Zong, Telenor, Ufone.
- Ammi has: a due K-Electric bill (consumer no `0400012345678`, ₨4,320), a pocket
  **عمرہ فنڈ** (goal ₨500,000, balance ₨120,000), Bilal + both Saras + a Meezan-bank
  contact ("بھائی جان") saved.

## Phase gate (every phase ends with)

1. All phase-plan tasks checked, tests green (`npm test` / `pytest`).
2. Working software demoed: Phases 1–2 via curl/tests; Phases 3–6 via Argent on iOS
   simulator + Android emulator with screenshots.
3. Conventional commit(s) on `main` of `~/work/payo`; roadmap Phase index status
   updated.

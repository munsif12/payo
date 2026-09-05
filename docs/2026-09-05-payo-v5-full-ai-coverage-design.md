# PAYO v5 — Every action through the AI, with visuals; natural Urdu voice

**Date:** 2026-09-05 · **Status:** action list approved in conversation (owner, "approved as
is") · **Builds on:** v4 (`2026-09-05-payo-v4-handsfree-voice-design.md`). Everything not
mentioned here stays as built.

## 1. Product changes

1. **Everything the classic UI can do, the assistant can do — and shows it.** Every read
   ("what was my last transaction", "what did I spend last month", "show my card") answers
   with a card, not just a sentence. Every write goes through the same confirmation → PIN
   gate as today. The approved action list is §2.
2. **Reliability is a feature.** Every action in §2 has a scripted-model test proving the
   right tool is called and the right card is emitted, plus a live smoke script. The generic
   "I can help you with your banking needs…" non-answer seen in long sessions is treated as
   a defect (§4.4).
3. **A spoken "yes" opens the PIN sheet.** When the assistant produces a confirmation card
   in chat, the app opens the PIN sheet immediately; the card stays behind it with its
   Confirm button so a cancelled sheet can be retried. One less tap in every money flow.
4. **Card safety rules.** Freezing is instant (panic action, no PIN). Unfreezing needs the
   PIN. The full card number and CVV are never spoken, written, or sent to the model; the
   assistant shows last-4 + expiry and offers the classic Card screen for full details.
5. **Natural Urdu.** The Urdu voice is chosen from clips (§5), and the Urdu prompt is
   rewritten for spoken register: short, warm, numbers said the spoken way, no bureaucratic
   phrasing.

## 2. Action list (approved)

Status: ✅ works today · 🟡 tool exists, needs a card/fix · 🆕 new. PIN column = money moves or
security-sensitive → confirmation card + PIN sheet.

| # | Domain | Action | Tool | Card | PIN | Status |
|---|---|---|---|---|---|---|
| A1 | Account | Balance | `get_balance` | `balance` | – | ✅ |
| A2 | Account | Account info | `get_account` | `account` | – | 🆕 |
| A3 | Account | Change name / Urdu name | `update_profile(name?, urdu_name?)` | `profile` | – | 🆕 |
| A4 | Account | Switch language | `update_profile(language)` | `profile` (app applies it) | – | 🆕 |
| A5 | Account | What can you do | `help` | `help` | – | 🆕 |
| T1 | Transactions | Last transaction | `list_transactions(limit=1)` → single | `receipt` | – | 🆕 card |
| T2 | Transactions | Recent transactions | `list_transactions(limit)` | `transactions` | – | 🟡 routing |
| T3 | Transactions | Filtered history (person / category / period) | `list_transactions(q?, category?, from?, to?)` | `transactions` + total line | – | 🟡 `q` filter new |
| T4 | Transactions | Spend for a period | `spending_summary(from,to)` | `spending` | – | 🟡 card new |
| T5 | Transactions | Compare periods | `spending_summary` ×2 | `spending` with `compare` | – | 🆕 |
| T6 | Transactions | Receipt for a transaction | `get_transaction(id)` | `receipt` | – | 🆕 |
| T7 | Statements | Statement for a period | `get_statement` | `statement` | – | ✅ |
| T8 | Statements | List my statements | `list_statements` | `statements` | – | 🆕 |
| C1 | Card | Show my card | `get_card` | `card` (last-4, expiry, status) | – | 🟡 |
| C2 | Card | Freeze | `freeze_card` | `card` (frozen) | no | 🟡 |
| C3 | Card | Unfreeze | `unfreeze_card` → pending action `card_unfreeze` | `confirmation` → `card` | yes | 🆕 |
| C4 | Card | Full number / CVV | prompt rule: refuse, point to Card screen | `card` + text | – | 🆕 rule |
| R1 | Recipients | List saved | `list_recipients` | `recipients` | – | 🆕 |
| R2 | Recipients | Delete | `delete_recipient(id)` after chat confirm | text | – | 🆕 |
| R3 | Actions | Cancel pending | `cancel_action(action_id)` | `confirmation` marked cancelled | – | 🆕 |
| B1 | Bills | Due bills | `list_due_bills` | `bills` (list) | – | 🟡 card |
| B2 | Bills | Paid bills history | `list_transactions(category='bill', from, to)` | `transactions` | – | 🆕 routing |
| B3 | Bills | Saved billers list / delete | `list_saved_billers` / `delete_saved_biller` | `billers` / text | – | 🆕 |
| B4 | Recharge | Mobile load | `list_telcos` → `recharge` | `telco_chips` → `confirmation` | yes | 🟡 chips new |
| P1 | Pockets | My pockets | `list_pockets` | `pockets` (list with progress) | – | 🟡 card |
| P2 | Pockets | Create | `create_pocket` | `pocket` | – | 🟡 |
| P3 | Pockets | Deposit | `pocket_deposit` | `confirmation` | yes | 🟡 |
| P4 | Pockets | Withdraw | `pocket_withdraw` | `confirmation` | yes | 🆕 |
| Q1 | Requests | Request money | `request_money` | `request` | – | 🟡 |
| Q2 | Requests | Incoming / outgoing | `list_requests(direction)` | `requests` (Approve/Decline buttons) | – | 🟡 |
| Q3 | Requests | Approve | `approve_request(id)` → pending `request_settlement` | `confirmation` | yes | 🆕 |
| Q4 | Requests | Decline | `decline_request(id)` | text | – | 🆕 |
| K1 | QR | Show my QR | `get_my_qr` | `qr` | – | 🆕 |

Excluded on purpose: OTP / sign-in / PIN setup, QR scanning (camera).

## 3. Backend contract changes (`services/backend`, Contract 1 amendments)

| Route | Change |
|---|---|
| `GET /transactions?q=` | NEW filter: case-insensitive match on `counterparty.name`, `counterparty.urduName`, `counterparty.detail`, `refNo`. Existing `category`, `from`, `to`, `limit`, `cursor` unchanged. |
| `GET /transactions/:id` | NEW. Own transaction only (404 otherwise). Same DTO as the list. |
| `GET /cards/mine` | Response gains `last4` and `maskedPan` (`•••• •••• •••• 1234`). `pan`/`cvv` stay for the classic Card screen. |
| `POST /cards/mine/unfreeze` | NEW. Creates a pending action `kind: 'card_unfreeze'`, `requiresPin: true`, `amountPaisa: 0`; the executor sets `frozen=false`. `POST /cards/mine/freeze` stays direct (no PIN) and only accepts `{ frozen: true }`. |
| `POST /pockets/:id/withdraw` | unchanged (already a pending action). |
| `POST /requests/:id/approve` | unchanged (`request_settlement`, PIN). |
| `GET /statements` · `GET /qr/mine` · `PATCH /me` · `DELETE /recipients/:id` · `DELETE /saved-billers/:id` · `POST /actions/:id/cancel` | unchanged; newly used by the AI. |

## 4. AI service (`services/ai`)

### 4.1 Tools (new or changed)
`get_account`, `update_profile(name?, urdu_name?, language?)`, `help`, `get_transaction(id)`,
`list_transactions(q?, category?, from?, to?, limit)`, `spending_summary(from, to,
compare_from?, compare_to?)`, `list_statements`, `get_card` (returns last-4/expiry/status only —
**the tool strips `pan`/`cvv` before anything reaches the model or a card**), `unfreeze_card`,
`list_recipients`, `delete_recipient`, `cancel_action`, `delete_saved_biller`, `list_telcos`,
`pocket_withdraw`, `list_requests(direction)`, `approve_request`, `decline_request`, `get_my_qr`.

### 4.2 Card kinds (new; TS mirror in `cardShapes.ts` must match field-for-field)

| kind | fields |
|---|---|
| `receipt` | `txn: Txn` (as in `transactions`), `shareText: Bilingual` |
| `spending` | `period: Bilingual`, `totalOutPaisa`, `totalInPaisa`, `byCategory: [{ category, label: Bilingual, totalPaisa, count, share: 0..1 }]`, `compare?: { period: Bilingual, totalOutPaisa, deltaPaisa, deltaPct }` |
| `account` | `name`, `urduName?`, `phone`, `memberSince`, `balancePaisa`, `language` |
| `profile` | `name`, `urduName?`, `language`, `applied: ['name'\|'urduName'\|'language']` — the app switches i18n when `applied` includes `language` |
| `help` | `intents: [{ label: Bilingual, intent: Bilingual }]` (tappable, sends `intent` in the UI language) |
| `card` | `last4`, `maskedPan`, `expiry`, `frozen`, `holder` |
| `statements` | `items: [{ statementId, period: Bilingual, totalInPaisa, totalOutPaisa, downloadUrl }]` |
| `recipients` | `items: [RecipientChip]` (tap → "send to <nickname>") |
| `bills` | `items: [BillCard fields]` (tap → "pay <biller> bill") |
| `billers` | `items: [BillerChip]` |
| `telco_chips` | `prompt: Bilingual`, `telcos: [{ telcoId, name, urduName? }]` |
| `pockets` | `items: [PocketCard fields + progress: 0..1]` |
| `request` | `requestId`, `direction: 'in'\|'out'`, `counterparty: { name, urduName?, phone }`, `amountPaisa`, `note?`, `status` |
| `requests` | `items: [request fields]`; Approve/Decline buttons on `direction='in'` + `status='pending'` (Approve → the app sends "approve request <id>" as a turn; the assistant calls `approve_request`) |
| `qr` | `payload`, `name`, `phone` (app renders the QR from `payload`) |

`confirmation` gains `autoOpenPin: bool` (default `true` for cards produced in chat).

### 4.3 Prompt policy additions (both languages)
- Reads: one tool call, one card, one short sentence. Never answer an account question
  without the tool; never say "I can help you with…" when a listed intent matches.
- "Last transaction" → `list_transactions(limit=1)` and emit `receipt`, not `transactions`.
- Periods: resolve "last month", "this week", "in August", "last year" to ISO dates using
  `today` (already in the prompt). Compare → two summaries in one turn.
- Card: never read the full number or CVV; on request say it's shown on the Card screen.
- Language switch: call `update_profile(language)` and reply in the new language.
- Destructive non-money actions (delete recipient/biller, decline request, cancel action):
  ask once in prose, act on a clear yes.

### 4.4 Routing reliability
- Model-facing history is windowed to the **last 12 turns** (+ the `[cards]` lines of those
  turns); older turns are dropped. Rationale: the generic non-answer appeared only in long,
  mixed-language sessions.
- The prompt carries a compact intent → tool table (one line per §2 row).
- **Intent matrix test:** `services/ai/tests/test_intent_matrix.py` — for every §2 row, an
  English and an Urdu utterance with the scripted model asserting (tool name, card kind).
  Also `scripts/ai-smoke.py`: runs the matrix live against the real model (≤40 Gemini
  calls, TTS off) and prints a pass/fail table — used by QA, not CI.

## 5. Urdu voice

- **U0 spike (before any voice code):** synthesize the same 3 demo sentences with 3 Cartesia
  Urdu library voices × 2 settings (default; speed 0.9 + a warm/calm emotion control) =
  6 clips into `docs/qa/v5/voice/`, ≤600 characters of credit. Owner picks; the pick goes
  into `CARTESIA_VOICE_UR` and the control settings into `tts.py`. If none is acceptable,
  ElevenLabs is the fallback (needs a key from the owner) — not built unless asked.
- **Prompt register:** `SYSTEM_PROMPT_UR` rewritten for spoken Urdu: ≤2 short sentences per
  reply, numbers in spoken form («اکیاسی ہزار آٹھ سو روپے»), no written-register words
  (تفصیلات، درج ذیل، مہیا), warm address («جی»). Tests assert the banned words are absent
  from the prompt and that a scripted balance reply is ≤ 2 sentences.
- Amounts for TTS: `trim_for_tts` gains an Urdu number-to-words pass for whole rupees up to
  99,99,999 so the voice never reads digits in Urdu (unit-tested).

## 6. Mobile (`apps/mobile`)

- New renderers in `CardView.tsx` for every §4.2 kind, kit components only; `spending` uses
  plain bars (no chart library); `qr` uses the existing QR renderer from `app/qr`.
- `confirmation` with `autoOpenPin` → `openPinSheet(action)` immediately; on cancel the card
  remains with Confirm.
- `profile` with `applied` including `language` → `i18n.changeLanguage` + persist (same path
  as the More → Profile toggle).
- `help` / `recipients` / `bills` / `billers` / `pockets` / `requests` taps send the listed
  intent text as a turn (keeps the v4 loop live).
- i18n parity for all new strings.

## 7. Acceptance

1. Unit: backend (new routes, unfreeze pending action, `q` filter), AI (intent matrix EN+UR
   for every §2 row, card models, Urdu number words, prompt register), mobile (cardShapes
   parity, renderers snapshot-free logic tests, autoOpenPin behaviour).
2. Live smoke: `scripts/ai-smoke.py` all rows PASS.
3. Simulator (Ammi): "what was my last transaction" → receipt card; "what did I spend last
   month" → spending card with bars; "compared to the month before" → compare row; "show my
   card" → masked card; "freeze my card" → frozen instantly; "unfreeze my card" → PIN sheet
   opens by itself → active; "who owes me" → requests card → Approve → PIN; "switch to
   Urdu" → UI flips and the reply is Urdu; "help" → help card; a spoken "yes" on a send
   opens the PIN sheet without tapping Confirm.
4. Voice: owner-picked Urdu voice in config; the balance reply in Urdu is spoken with number
   words, not digits.

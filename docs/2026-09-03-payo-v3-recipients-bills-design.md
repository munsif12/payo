# PAYO v3 — Bank-aware sends, saved recipients, in-chat PIN, biller flow, Urdu fixes

**Date:** 2026-09-03 · **Status:** approved in conversation (owner) · **Builds on:** v2 revamp
(`2026-09-02-payo-revamp-design.md`). Everything not mentioned here stays as built.

## 1. Product changes

1. **Send money works like a Pakistani wallet (Easypaisa model).** A recipient is
   *identifier + institution*: a phone number for wallets (PAYO, Easypaisa, JazzCash,
   SadaPay, NayaPay) or an IBAN/account number for banks. The app resolves the account
   title before anything else, shows the recipient details for confirmation, then takes
   the PIN and sends. After success the user may **save the recipient** under a nickname.
2. **The assistant drives the same flow conversationally.** "Pay 100 rupees to
   0333…" with no institution → the assistant asks which bank or wallet (offering the
   popular ones as chips) → resolves the title → shows a *recipient card* → user
   confirms in chat → PIN entered **in a bottom sheet inside the chat** → money moves →
   success card → "Save this recipient?" chips. "Send 500 to Ali" → the assistant searches
   **saved recipients** by name or number; several matches → asks which one.
3. **No dummy recipients.** The seed pre-saves nothing. The six demo users remain as real
   PAYO accounts reachable by phone + PAYO.
4. **Bills the same way.** Several dummy billers exist (electricity, gas, water, internet,
   mobile). The assistant (or the classic screen) asks for the biller and the
   reference/consumer number, looks the bill up, shows the details, confirms, takes the
   PIN in the sheet, pays, then offers to **save the biller + reference** under a
   nickname. "Pay my electricity bill" later resolves from saved billers; several saved →
   ask which.
5. **PIN is a bottom sheet everywhere** (chat, classic send, bills, pockets, requests):
   no separate PIN page. Wrong PIN shakes inside the sheet; lockout shows the message.
6. **Urdu fixes.** When the app language is Urdu the assistant replies in Urdu, always.
   Spoken Urdu is transcribed in **Urdu script (Perso-Arabic), never Devanagari**.

## 2. Backend contract changes

New/changed routes (all 🔒 session JWT unless noted; standard response shape; paisa ints):

| Route | Payload → `data` |
|---|---|
| `GET /institutions?q=` | `{ items: [{ id, name, urduName, kind: 'wallet'\|'bank', code, popular: boolean }] }` — ~35 entries: wallets PAYO, Easypaisa, JazzCash, SadaPay, NayaPay; banks HBL, Meezan, UBL, MCB, Allied, Bank Alfalah, Askari, Faysal, Habib Metro, JS Bank, Soneri, Standard Chartered, Bank Al Habib, Bank of Punjab, NBP, Sindh Bank, Al Baraka, Dubai Islamic, BankIslami, Silk, Summit, Zarai Taraqiati, First Women, U Microfinance, Telenor Microfinance, Mobilink Microfinance, ABHI Microfinance, Advans Microfinance, Al Meezan Investments, Khushhali, FINCA, NRSP, Bank Makramah. `popular` = the 5 wallets + HBL, Meezan, UBL, MCB, Allied. |
| `POST /transfers/resolve` `{ institutionId, identifier }` | → `{ title, institution: {id,name,urduName,kind}, identifier, linkedUserId? }`. PAYO + phone → the real user (404 `RECIPIENT_NOT_FOUND` if none, 400 `SELF_TRANSFER` if self); wallets → phone `+92…`/`03…` normalised, deterministic title; banks → IBAN (`PK\d{2}[A-Z]{4}\d{16}`) or 10–16 digit account no, deterministic title. Validation errors 400 `INVALID_IDENTIFIER`. |
| `POST /transfers` | body becomes `{ to: { recipientId } \| { institutionId, identifier }, amountPaisa, note? }` (the legacy `phone`/`bank`/`contact` shapes are removed). Resolves again server-side, embeds `{ institution, identifier, title, linkedUserId }` in the pending-action payload; fee: PAYO→PAYO 0, other wallets 0, banks 2500. |
| `GET /recipients?q=` · `POST /recipients` `{ nickname, institutionId, identifier }` · `DELETE /recipients/:id` | Saved recipients (replaces `/contacts`). Create resolves the title and stores `{ nickname, title, institution, identifier, linkedUserId?, lastUsedAt }`. Search matches nickname, title, identifier (case-insensitive). Duplicate `(userId, institutionId, identifier)` → 409 `ALREADY_SAVED`. |
| `POST /actions/:id/execute` | unchanged; response gains `{ transaction, recipientSuggestion?: { institutionId, identifier, title, alreadySaved } }` for `send_money*` kinds so clients can offer "save". |
| `GET /billers` | unchanged list, seed extended: K-Electric, LESCO, SSGC, SNGPL, PTCL, Nayatel, KWSB, WASA Lahore, Jazz, Zong, Telenor, Ufone (categories electricity/gas/internet/water/mobile). |
| `GET /saved-billers` · `POST /saved-billers` `{ nickname, billerId, consumerNo }` · `DELETE /saved-billers/:id` | Saved billers. Create performs the lookup and stores `consumerName`. Duplicate → 409. |
| `POST /bills/pay` | response/payload unchanged; execute response gains `billerSuggestion?: { billerId, consumerNo, consumerName, alreadySaved }`. |
| `GET /bills/due` | now also includes due bills of saved billers (lookup refreshed on demand). |

Removed: `/contacts`, `/banks`, `/banks/resolve-title`. Models: `Contact` → `Recipient`;
`Bank` → `Institution`; new `SavedBiller`. Seed: institutions + billers; no recipients; no
saved billers; Ammi keeps her due K-Electric bill (consumer `0400012345678`).

## 3. AI service

- Tools: `list_institutions(query?)` (returns `institution_chips` card with the popular
  ones when the user must pick), `resolve_recipient(institution_id, identifier)` (→
  `recipient` card), `search_recipients(query)` (saved; 0 → say none saved and ask for
  number + institution; 1 → proceed; >1 → `recipient_chips`), `send_money(recipient_id?
  | institution_id + identifier, amount_paisa)` (→ `confirmation` card), `save_recipient
  (institution_id, identifier, nickname)`, `list_billers`, `lookup_bill(biller_id,
  consumer_no)` (→ `bill` card), `list_saved_billers` (→ chips when >1), `pay_bill`,
  `save_biller(biller_id, consumer_no, nickname)`.
- Policy (both prompts): never send without a resolved title shown and confirmed by the
  user; identifier without institution → ask (chips); after a successful send/pay the app
  shows the save prompt — the assistant only calls `save_*` when the user asks or accepts.
- **Reply language is a hard rule**: the system prompt is regenerated per turn with the
  UI language and the agent's final text is verified: if `language == 'ur'` and the reply
  contains no Arabic-script characters, re-prompt once with "Answer in Urdu script only".
- **Transcription**: the STT prompt states the audio is Urdu/English speech and must be
  transcribed in Urdu (Perso-Arabic) script — Devanagari is forbidden; Roman Urdu input
  in text stays as typed. Unit-tested via the prompt text and a script-check helper.
- Card kinds added: `institution_chips`, `recipient`, `recipient_chips`,
  `save_prompt` (`{ kind:'save_prompt', target:'recipient'|'biller', … }`), `biller_chips`.

## 4. Mobile

- **`PinSheet`** (bottom sheet, `@gorhom/bottom-sheet` or a Reanimated sheet): title +
  subtitle (what is being paid), 4 `PinDots`, 72pt `Keypad`, shake on `INVALID_PIN`,
  `PIN_LOCKED` message, executes the pending action and resolves with the transaction.
  Replaces the PIN stage of `confirm/[actionId]`; used by chat cards and every classic
  flow.
- **Chat**: `ConfirmationCard` → opens `PinSheet` in place; success renders a
  `success` card plus a `save_prompt` card ("Save Munsif as a recipient?" → nickname
  input inline → `POST /recipients`). New renderers for `recipient`, `recipient_chips`,
  `institution_chips`, `biller_chips`. Chip taps send their text as the next turn.
- **Classic Send** (Easypaisa model): 1) identifier input ("IBAN, phone, or account
  number") with saved-recipients list below (search, swipe/long-press to delete);
  2) institution picker (searchable list, logo initials, popular first); 3) resolved
  recipient screen (avatar, title, institution, identifier) → amount → confirm details
  (amount, fee, total, channel) → `PinSheet` → success with "Save recipient" toggle.
- **Bills**: biller list grouped by category + "Saved" section; consumer number →
  details → confirm → `PinSheet` → success with "Save biller" toggle.
- Wallet quick actions and Home suggestions unchanged; Pay hub gains "Saved recipients".
- i18n for all of the above in en + ur.

## 5. Acceptance (simulator, Ammi)

1. Chat: "pay 100 rupees to 03135468810" → assistant asks bank/wallet (chips) → tap
   "Easypaisa" → recipient card with a resolved title → confirm → PIN sheet in chat →
   success card → "Save recipient?" → save as "Munsif" → Wallet shows the transaction.
2. Chat: "send 250 to Munsif" → resolves the saved recipient → confirm → PIN sheet →
   success. Save a second "Munsif" (different number) → "send to Munsif" → asks which.
3. Chat in Urdu: reply is Urdu script; a spoken Urdu clip (or the typed Urdu-script
   turn) yields an Urdu-script transcript — never Devanagari.
4. Chat: "pay my electricity bill" with none saved → asks biller + reference → lookup →
   bill card → confirm → PIN sheet → paid → "Save biller?" → saved; second time it pays
   from the saved biller directly.
5. Classic: Send → number → picker → recipient → amount → confirm → PIN sheet → success →
   save; Bills → biller → number → confirm → PIN sheet → paid → save.
6. No pre-saved recipients on a fresh seed; suites green.

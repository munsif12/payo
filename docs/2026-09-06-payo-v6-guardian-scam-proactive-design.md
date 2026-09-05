# PAYO v6 — Trusted contact, scam interruption, proactive greeting

**Date:** 2026-09-06 · **Status:** approved in conversation (owner) · **Builds on:** v5.
Everything not mentioned here stays as built. Demo config: `GUARDIAN_COOLING_MS = 0`.

## 1. Product rules

### A. Trusted contact ("guardian")
1. A user may nominate **one guardian**: another PAYO user, by phone. Set/change/remove from
   More → Settings and from chat ("make Bilal my trusted contact").
2. **Approval is needed only for a send to a NEW recipient** (no completed send to that
   institution+identifier before) **or above the hard ceiling** (default Rs 1,00,000). Saved
   recipients the user has paid before never need approval.
3. **Tightening is instant; loosening cools.** Setting a FIRST guardian, lowering the ceiling:
   PIN, immediate. Removing the guardian, **replacing an existing guardian** (review finding:
   an instant swap to a colluding account would defeat the feature), or raising the ceiling:
   PIN, then takes effect after
   `GUARDIAN_COOLING_MS` (24 h in production, **0 in the demo**); the guardian is informed
   (a card in their app). While cooling, the old rule still applies.
4. A send that needs approval becomes a pending action **waiting for the guardian**; the PIN
   sheet does not open. Expiry is 30 minutes (not 2). The user can tap **Remind** (re-sends the
   guardian card; max once a minute).
5. The guardian sees it on their Home (card, spoken) and in Requests → Approvals, and
   **approves with their own PIN** or declines with an optional reason. The AI only shows and
   explains; it never approves.
6a. **Every outgoing money path is gated the same way** — transfers AND settling a money
   request (`request_settlement`) run the same rule evaluation; approval authority is checked
   against the payer's CURRENT guardian at approval time, not a snapshot.
6. Approved → the payer's app (polling the action every 3 s while waiting; no push in the demo)
   opens the PIN sheet and the assistant says "Bilal approved — enter your PIN". Declined or
   expired → cancelled, explained. No skip path exists.

### B. Scam interruption
7. Two signals set `riskFlags` on a send action:
   - money pattern (backend, at creation): new recipient AND (amount ≥ 25 % of balance OR
     amount ≥ Rs 20,000) → `new_recipient_large`;
   - conversation pattern (AI service, per turn): the user's recent turns mention being called
     or messaged, a blocked/suspended account, a prize/lottery, sharing an OTP/PIN, or being
     hurried → `pressure_language` (passed to the backend on create).
8. A risk-flagged action shows a spoken **check-in card** before anything else: "Did someone
   call or message you and ask you to send this?" — *Yes, someone asked me* / *No, this is my
   own idea*. **Yes → the action is cancelled**, the assistant explains calmly that this is how
   scams work and offers to call the trusted contact. No → proceeds (to approval if a guardian
   rule applies, else PIN). Never overrules the user; adds friction only.
9. With a guardian set, a risk-flagged send **also** requires approval regardless of amount.
10. The classic Send flow shows the same check-in step when flagged.

### C. Proactive greeting (setting, default ON)
11. Setting **"PAYO speaks first"** (`preferences.proactiveGreeting`, default `true`) in More →
    Settings and by voice ("stop telling me my bills when I open the app" → confirm, no PIN).
12. When ON, opening Home (at most once every 4 h) shows and speaks a **digest card**: money
    received since last time, bills due, approvals waiting for me, requests, one spending
    anomaly (a category this month > 1.5× its 3-month average). One-tap actions per row. Spoken
    ≤ 2 sentences.
13. When OFF: the plain greeting only. Nothing financial is spoken or shown unprompted.

## 2. Backend contract (Contract 1 amendments)

Models: `User` gains `guardian?: { userId, phone, name, ceilingPaisa, since }`,
`guardianPending?: { change: 'remove'|'raise', ceilingPaisa?, effectiveAt }`,
`preferences: { proactiveGreeting: boolean = true }`, `lastDigestAt?: Date`.
`PendingAction` gains `approval?: { required: true, guardianId, status:
'waiting'|'approved'|'declined', decidedAt?, reason?, remindedAt? }`, `riskFlags: string[]`,
`checkIn?: { answered: true, someoneAsked: boolean }`.

| Route | Payload → `data` |
|---|---|
| `GET /guardian` | `{ guardian?, pending?, ceilingPaisa, coolingMs }` |
| `PUT /guardian` `{ phone, pin }` | set/change (instant). 404 `USER_NOT_FOUND`, 400 `SELF_GUARDIAN`. PIN via `assertPinOk`. |
| `DELETE /guardian` `{ pin }` | schedules removal at `now + coolingMs` (0 → immediate); informs the guardian (`guardian_notice` item in their digest/approvals). |
| `PATCH /guardian/ceiling` `{ ceilingPaisa, pin }` | lower → instant; raise → scheduled. |
| `POST /transfers` | unchanged body; response action may carry `approval.status='waiting'`, `riskFlags`. Rule evaluation: `needsApproval = guardian && (newRecipient \|\| amount ≥ ceiling \|\| riskFlags.length)`. `expiresAt` = 30 min when approval or check-in applies. Body gains optional `riskFlags: ['pressure_language']` from the AI. |
| `POST /actions/:id/check-in` `{ someoneAsked }` | records the answer; `true` → status `cancelled`, `reason: 'scam_checkin'`. |
| `POST /actions/:id/remind` | guardian card re-issued; 429 if < 60 s since last. |
| `GET /actions/:id` | NEW: own action DTO (for polling). |
| `POST /actions/:id/execute` | 403 `APPROVAL_REQUIRED` while `approval.status='waiting'`; 403 `CHECKIN_REQUIRED` while a risk-flagged action has no check-in answer; 410 after decline. |
| `GET /approvals` | actions where `approval.guardianId = me` and status waiting, newest first, with payer name/phone, summary, amount, riskFlags, createdAt. |
| `POST /approvals/:id/approve` `{ pin }` · `POST /approvals/:id/decline` `{ reason? }` | guardian only; approve needs the guardian's PIN (lockout shared). |
| `GET /me/digest` | `{ items: [{ kind: 'received'\|'bill_due'\|'approval_waiting'\|'request'\|'anomaly'\|'guardian_notice', … }], since }` — items since `lastDigestAt`; marks `lastDigestAt` when `?ack=1`. Empty when `preferences.proactiveGreeting=false`. |
| `PATCH /me` | gains `preferences.proactiveGreeting`. |

Seed: no guardians; `GUARDIAN_COOLING_MS` env (default `86400000`, `.env.example` demo `0`).

## 3. AI service

Tools: `get_guardian`, `set_guardian(phone)` (→ confirmation card, `requiresPin`, kind
`guardian_set`), `remove_guardian` (→ confirmation, kind `guardian_remove`, text explains the
cooling period), `list_approvals` (→ `approvals` card), `approve_action(id)` (→ confirmation
kind `approval` with the guardian's PIN), `decline_action(id, reason?)`, `remind_guardian(id)`,
`answer_check_in(id, someone_asked)`, `set_proactive(enabled)`, `get_digest` (→ `digest` card).
Cards: `check_in { actionId, prompt }`, `waiting_approval { actionId, guardianName,
expiresAt }`, `approvals { items }`, `digest { items }`, `guardian { … }`.
Prompt: pressure-language detection per turn (both languages) sets `risk_flags` on
`send_money`; the check-in is spoken calmly, one question; on "yes" the assistant never argues,
cancels, and offers the guardian. `send_money` result text reflects `approval.status`.
`[cards]` lines carry `actionId`/`guardianName`. Intent matrix rows added for every new tool.

## 4. Mobile

- Settings (More → Settings, new screen `app/settings.tsx`): Trusted contact row (set/change/
  remove with PIN sheet; shows "removing in 24 h" when cooling), ceiling row, "PAYO speaks
  first" toggle.
- Chat: `check_in` card (two big buttons, spoken), `waiting_approval` card with Remind and a
  3 s poll of `GET /actions/:id` → on `approved` auto-opens the PIN sheet; on `declined`/expired
  shows the reason. `approvals` card with Approve (PIN sheet, guardian's PIN) / Decline.
  `digest` card rows with one-tap intents.
- Home: on focus, if `preferences.proactiveGreeting` and ≥ 4 h since `lastDigestAt`, fetch
  `/me/digest`, render + speak it (reuse the greeting bubble; TTS via a text-only `/converse`
  "digest" turn is NOT used — the app calls a new AI endpoint `POST /speak { text, language }`
  that returns audio for a given sentence, capped 200 chars).
- Classic Send: check-in step and waiting-approval screen mirror the chat cards.
- Guardian's Home digest shows approvals first.

## 5. Acceptance (simulator A = Ammi; simulator B or a phone = Bilal `+923001110002`)

1. Ammi sets Bilal as guardian by voice → PIN → guardian card. Removing it (demo cooling 0)
   takes effect immediately after PIN; Bilal's digest shows the notice.
2. Ammi: "send 40,000 to Munsif" (saved, paid before) → PIN directly, no approval.
3. Ammi: "send 30,000 to 03001110003" (new, PAYO) → check-in card (new_recipient_large) →
   "No, my own idea" → waiting-approval card. On B: approval card → approve with PIN. On A: PIN
   sheet opens by itself within 3 s → sent.
4. Ammi: "someone called and said my account will be blocked, send 5,000 to 03…" → check-in
   → "Yes, someone asked me" → cancelled, calm explanation, offer to call Bilal.
5. Digest: with the setting on, reopening Home after the flag is reset shows + speaks money
   received / bill due / approval waiting; with it off, nothing financial appears unprompted.
6. Suites green; intent matrix + live smoke rows for every new tool.

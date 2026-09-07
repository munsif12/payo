# PAYO — Product and Technical Proposal

**Date:** 2026-09-07 · **Status:** working demo, not a product · **Repo:** `~/work/payo`

## 1. Summary

PAYO is a working banking demo you talk to. You sign in with a phone number, a demo OTP and a
4-digit PIN — no email, no password, no forms. Then you either tap through a normal wallet app
or hold a conversation with it, in English, Urdu script or Roman Urdu, by typing or by speaking.
One mic tap starts a hands-free loop that keeps listening after every reply. Every answer comes
back as a card, and everything the classic app does the assistant does too. The assistant never
moves money: it prepares a pending action, and a confirmation card plus a PIN executes it
exactly once. Around that sit three safety features built for the people we are aiming at — a
trusted contact who approves large payments to new recipients with their own PIN, a scam
check-in that asks one calm question before a risky send, and a proactive greeting that says
what changed since you last opened the app. Three services, a seeded local MongoDB, iOS.

## 2. The problem (stated as a design premise)

We did not survey anyone. Everything below is a premise we chose to build against, not a
measured finding.

The premise: the hardest customer on a smartphone is a parent. They read slowly, they do not
read menus, and they will not fill a form. They speak Urdu, often mixed with English and often
written in Roman letters. They are the people scam callers pick — "your account will be
blocked", "you won a prize", "read me the code you just got" — because the pressure works and
nobody is in the loop to slow the payment down.

A normal banking app answers this by adding screens. That makes it worse: if someone cannot
navigate five screens, a sixth confirmation screen protects nobody. The interface has to be a
conversation, and the safety has to sit inside that conversation, at the moment money moves.

## 3. What PAYO is

**Talk to it like a phone call.** Tap the mic once. PAYO listens, replies out loud, and starts
listening again — no tap per turn. Tap the reply to interrupt, tap X to end. It ends by itself
after two silent turns or 12 spoken turns (a cost guard: every turn is a Gemini call plus a
speech synthesis).

**Every action is answered with a card.** 32 card kinds, drawn natively by the app: balance,
receipt, spending with bars and a month-over-month row, masked card, statements, saved
recipients and billers, pockets, requests, QR, profile, help, plus the confirmation, check-in,
waiting-for-approval and approvals cards. When a card is on screen the assistant's sentence is
spoken but not printed — the card carries the detail, the voice carries the gist.

**The assistant covers the whole app.** 46 tools, one per capability, calling the same REST API
the app calls. Send money works the way a Pakistani wallet does: a recipient is an identifier
plus an institution (phone for PAYO/Easypaisa/JazzCash/SadaPay/NayaPay, IBAN or account number
for a bank), resolved to a real account title before anything moves, then optionally saved
under a nickname. Bills are the same — biller plus reference, then saved for a one-line repeat.

### Safety model

| Gate | What it does | Who holds the key |
|---|---|---|
| Prepare, never execute | Every write tool creates a `PendingAction`. Money moves only at `POST /actions/:id/execute` — atomic, idempotent, single-use, 2-minute expiry (30 minutes when a guardian or a risk flag applies) | The backend |
| Confirmation card → PIN | The card states amount, fee, total and destination. A spoken "yes" opens the PIN sheet in place — the same bottom sheet in chat and in the classic screens | The user |
| Guardian approval | With a trusted contact set, a send needs their approval above the ceiling (default ₨1,00,000), or to a new recipient at ≥ ₨20,000, or when a pressure flag applies. The payer's app polls every 3 s and opens the PIN sheet when approval lands | The guardian, with **their own** PIN |
| Scam check-in | One question before a risky send: "Did someone call or message you and ask you to send this?" *Yes* cancels the action and explains calmly. It never argues and never blocks | The user |
| Age-based rules | `dateOfBirth` on the profile; `senior = age ≥ 60`. Pressure language checks in with everyone; seniors also get checked on a new recipient ≥ ₨20,000 or ≥ 25 % of balance, with a 24-hour memory per recipient after a "No" | The backend |
| Cooling periods | Tightening is instant. Removing a guardian, replacing one, or raising the ceiling is a loosening: it cools (`GUARDIAN_COOLING_MS`, 24 h in production, 0 in the demo) and the outgoing guardian keeps authority until it lands | The backend clock |
| The AI's hard limits | It never moves money, never sees or asks for a PIN, and never approves anything. It proposes; the app and the user dispose | By construction |

## 4. What is built today

| Capability | Evidence |
|---|---|
| Phone → OTP → PIN auth, session expiry on reseed | Backend suite; simulator (v3 QA) |
| Classic wallet: Home, Wallet, Pay, More; send, bills, recharge, pockets, requests, card, statements, QR, activity | Live simulator, v3 QA item 5 (classic send end-to-end) |
| Bank-aware send: institution chips → resolve → confirm → in-chat PIN → success → save recipient | Live simulator, v3 QA re-run items 1–2 (incl. duplicate-name disambiguation) |
| Bill by biller + reference, then saved-biller repeat | Live simulator, v3 QA re-run item 4 |
| Urdu: RTL, Nastaliq, Urdu-script replies, Roman Urdu input, "switch to Urdu" by voice | Live simulator, v3 QA item 3; v5 QA A1/A4 |
| Hands-free loop: silence end, interrupt, typing ends it, PIN pause, 12-turn cap | Live simulator, v4 QA items 1–5, all PASS |
| Every classic action through the AI as a card | Live simulator (v5 QA §7.3) + intent matrix (49 rows × EN/UR) + live smoke |
| Guardian round-trip across two devices, and the scam check-in stopping a send | Live two-device acceptance, v6 QA items 1–4, all PASS |
| Age-based rules, scoped pressure flag, spoken outcome after PIN, institution/biller logos | v6.1 addendum: live checks plus `riskRules.test.ts` |
| Suites | backend **154**, AI **325**, mobile **365**; mobile `tsc --noEmit` clean |

## 5. Architecture

Three services, one seeded MongoDB (single-node replica set, so multi-document writes are
transactional).

```
apps/mobile (Expo RN + TS)
   │ REST + JWT                  │ /converse: audio or text up, SSE down
   ▼                             ▼
services/backend (Node/Express/Mongoose)  ◄── REST + the SAME JWT ── services/ai (FastAPI/LangGraph/Gemini)
```

**The AI is just another client.** It has no database access and no privileged path. It calls
the backend's public REST API with the user's own JWT, forwarded verbatim. Anything the user
cannot do, the agent cannot do either. Every money-moving tool it has ends at a pending action.

**One card contract, two implementations, one parity test.** Card shapes are defined once as
Pydantic models in `services/ai/app/cards.py`, exported to a checked-in JSON snapshot, and
asserted field-for-field against the app's TypeScript shapes by `cardShapes.parity.test.ts`.
A field added on one side and not the other fails the mobile suite.

**Deterministic guards around a probabilistic model.** The model is Gemini and it is allowed
to be creative about words, not about actions. Each of these came from a live failure and has
a regression test:

- **cancel pre-route** — "cancel that" after a confirmation card cancels it directly, zero
  model calls (in Urdu it used to route to `help` and leave the action alive)
- **announce-without-tool** — a reply promising a card, or announcing data no tool fetched, is
  re-prompted instead of shown
- **echo** — a reply repeating the previous answer verbatim is re-prompted
- **generic-answer** — "I can help you with your banking needs…" is treated as a defect
- **telco fallback** — "which network?" asked in prose is nudged; if it is asked again the chips
  are fetched and attached anyway, because a voice user cannot type an id
- **refuse-instead-of-flag** — refusing a pressured send is nudged into flagging it, so the user
  still gets the check-in card and the decision
- **sticky scoped pressure flag** — the flag survives across turns but is scoped to the named
  recipient and expires after 30 minutes, so an unrelated payment does not inherit it
- **history window** — the model sees 12 turns; card facts (ids, identifiers, institutions) are
  read back from the full history, not the trimmed window

**The routing gate.** `services/ai/scripts/ai-smoke.py` drives every intent-matrix row against
the real model and a real backend, in English and Urdu, and classifies each failure as ROUTING,
TOOL, DATA or ERROR. Run it before a demo. Its first honest run scored 22/34 and found five
real defects; the final v5 run scored 67/70.

## 6. Honest limits

- **Demo only.** No payment rails, no real SMS (the OTP is echoed back by the API), no KYC, no
  push, no store build, no rate limiting or HMAC — JWT auth only. Balances, account titles,
  bills and card numbers are deterministic fakes.
- **Logos** come from Google's favicon service by domain, with an initials fallback. Fine for a
  demo, not a licensing position.
- **Verified on an iOS simulator** (iPhone 17 Pro, Expo Go), plus a second one for the guardian
  round-trip. Android has not been run since the early phases.
- **Urdu is a step behind English.** Two v6 smoke rows chain one turn late in Urdu. Money never
  moved wrongly — routing lag, not a safety gap.
- **The Cartesia balance is low.** Utterances are capped at 400 characters, retries are off, and
  any failure falls back to a silent stub. Keep demo turns short.
- **Routing is probabilistic.** A full 70-row run still has about one intermittent miss.

Production would need real rails and a settlement ledger, real KYC and SMS, push, an audit trail
on every gate decision, rate limiting and request signing, secrets management, and a privacy
review of what reaches the model (today the PAN and CVV never do, by rule).

## 7. Roadmap

**Phase 1 — make the conversation feel like a phone call.** Wake word, so the mic tap goes away.
Streaming duplex (Gemini Live over a WebSocket) with echo cancellation — what voice barge-in
needs, and what would cut turn latency. Read-back confirmation, so the amount and recipient are
spoken before the PIN sheet, plus "repeat that" and "say it slower" as first-class turns.

**Phase 2 — close the honest gaps.** Android parity. Urdu smoke rows to full green. The
proactive greeting verified spoken on a live Home. A spoken money flow driven through the PIN
pause. Guardian remove/replace cooling and the decline path exercised on device.

**Phase 3 — make it a bank.** Real KYC, real rails and settlement, real SMS OTP, push for the
guardian instead of a 3-second poll, and the production hardening listed above.

## 8. How to run the demo

```bash
docker compose up -d mongo                                          # Mongo on host port 27018
cd services/backend && npm run seed                                 # required after every pull
GUARDIAN_COOLING_MS=0 npm run dev                                   # :4000 — 0 = instant guardian changes
cd services/ai && uv run uvicorn app.main:app --port 8000           # needs GEMINI_API_KEY in .env
cd apps/mobile && npx expo start                                    # Metro :8081 → Expo Go on a simulator
cd services/ai && uv run python scripts/ai-smoke.py --language both # routing gate, before you present
```

**Demo users:** Ammi Jaan `+923001110001` (65, the primary persona — seeded history, a due
K-Electric bill, an Umrah pocket) and Bilal Ahmed `+923001110002` (the trusted contact, on a
second simulator). PIN `1234` for both; the OTP is echoed back by the API. Then walk
`docs/DEMO-SCRIPT.md`.

# PAYO — AI-first banking demo (English-first, Urdu bilingual)

PAYO is an AI-first banking demo built for a non-tech, Urdu-speaking user. Sign in with
just a **phone number** (OTP → PIN, no email/password), land on an animated AI-first
**Home** that greets you and offers the five things people actually do, and ask PAYO for
anything by typing or speaking ("Pay a bill", "بلال کو 1500 بھیجو", "bijli ka bill pay
karna hai"). **Hands-free:** one mic tap starts a conversation that keeps listening after
every reply — no tap per turn; tap to interrupt, tap X to end, and it ends by itself on
silence or after 12 turns. **Everything the classic UI does, the assistant does too — and
shows it as a card:** last transaction (receipt), spend by category with month-over-month
comparison, your card (masked; freeze instantly, unfreeze with PIN), statements, saved
recipients and billers, pockets, money requests with Approve/Decline, your QR, profile and
language ("switch to Urdu"), and help. When a card is shown the text is spoken, not
displayed — the card carries the detail, the voice carries the gist. **Built for the family
around the user:** a **trusted contact** approves large sends to new recipients with their
own PIN (people you already pay never wait; loosening the rule cools for 24 h — set
`GUARDIAN_COOLING_MS=0` for a demo), a **scam check-in** asks one calm question before a risky
send and stops it if someone asked you to pay, and PAYO **speaks first** when you open the
app (money received, bills due, approvals waiting — a setting, on by default). Every money-moving request is understood by the agent but only ever
**prepared** — a confirmation card + PIN is the only thing that ever executes it. A full
classic wallet UI (tabs: Home / Wallet / Pay / More) covers every capability by hand, in
either language. Demo only: no real money movement, no payment gateways.

**Send money works like a Pakistani wallet** (Easypaisa/JazzCash model): a recipient is
*identifier + institution* — a phone number for PAYO/Easypaisa/JazzCash/SadaPay/NayaPay,
or an IBAN/account number for a bank. The app (or the assistant, via chips) resolves the
account title before anything moves, then the user can **save the recipient** under a
nickname for next time. Bills work the same way — pick or type a biller + reference,
confirm, then optionally **save the biller** for a one-line repeat next time. **PIN entry
is a bottom sheet everywhere** — chat, classic Send, Bills, pockets, requests — never a
separate page.

## What's inside

| Piece | Stack | Highlights |
|---|---|---|
| `apps/mobile` | Expo SDK 57 · TypeScript · expo-router · RTK Query · i18next | Phone → OTP → PIN auth; AI-first animated Home (greeting + stagger, listening state, wrong-PIN shake); English default with an instant Urdu (RTL, Nastaliq) toggle; new design-system tokens/UI kit/motion primitives across every screen; shared confirm → PIN → execute flow; hands-free voice loop (pure reducer + `useVoiceLoop`: two-timer silence detection, no send without speech, tap-to-interrupt, PIN pause, 12-turn credit cap); trusted-contact Settings, check-in / waiting-approval / approvals cards, spoken outcome after every PIN; **395 jest tests** |
| `services/backend` | Node 20 · Express 4 · Mongoose 8 · TS · zod · pdfkit | All money movement; pending-action engine (PIN-gated, idempotent, 2-min expiry, atomic Mongo transactions); phone-only OTP auth, profile, institutions directory + recipient resolve/save, due bills, transfers, bills, saved billers, recharges, requests, pockets, cards, statements (PDF, English-only), QR, chat persistence; guardian + approvals + check-in gates, age-based risk rules, digest; deterministic seed world; **159 jest tests** |
| `services/ai` | Python 3.12 · FastAPI · LangGraph · Gemini · Cartesia | The agent is *just another client*: tools calling the backend with the user's JWT — write tools only ever create pending actions. Bank-aware send flow (institution chips, resolve gate, saved recipients), saved billers, in-chat save prompts. 48 tools / 32 card kinds covering every classic action (receipt, spending compare, masked card + PIN-gated unfreeze, statements, pockets, requests, QR, profile, help); card turns are ≤2-sentence spoken summaries (bullets/markdown stripped); 12-turn history window; intent matrix (49 rows × EN/UR) + live routing gate `scripts/ai-smoke.py`; spoken-register Urdu prompt, Urdu number-words before TTS, Aryan "warm" voice. Understands English, Urdu script, and Roman Urdu; always replies in the user's selected language, Urdu transcription in Perso-Arabic script only. Gemini native-audio in, Cartesia TTS out (silent stub without a key), SSE per contract; **325 pytest tests** |
| `scripts/mock-ai` | FastAPI | Offline/no-key demo fallback: same SSE contract, real backend actions, canned reasoning for the demo utterances |

Docs: see the **Documents** index at the end of this file.

## Prerequisites

- Docker (Desktop) — MongoDB 7 as a single-node replica set
- Node 20+, `uv` (Python 3.12), Xcode and/or Android Studio for simulators

## Run

| What | Command |
|---|---|
| Mongo (replica set, host port **27018**) | `docker compose up -d mongo` |
| Seed the demo world (**re-run after every pull**) | `cd services/backend && npm run seed` |
| Backend (:4000) | `cd services/backend && GUARDIAN_COOLING_MS=0 npm run dev` (the backend does not read `.env`; `0` makes guardian changes instant for the demo) |
| AI service (:8000) | `cd services/ai && uv run uvicorn app.main:app --port 8000` |
| AI fallback without keys | `cd services/ai && uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai` |
| Mobile (Metro :8081) | `cd apps/mobile && npx expo start` → open in Expo Go on the iOS simulator (`i`) / Android emulator (`a`) |

**Sign in:** phone `+923001110001` (Ammi Jaan; five more seeded users, same pattern), OTP
is echoed back by the demo backend (`demoOtp`), PIN `1234`. New phone numbers go through
Create PIN instead of Enter PIN. Then follow `docs/DEMO-SCRIPT.md`.

### API keys (`services/ai/.env`, gitignored)

```
GEMINI_API_KEY=...     # required for the live agent + Urdu audio transcription
CARTESIA_API_KEY=...   # optional; without it TTS is a silent stub (text+cards still work)
```

### Tests

```bash
cd services/backend && npm test           # 159 tests (money invariants, pending actions, guardian/risk rules, auth, e2e)
cd services/ai && uv run pytest           # 325 tests (tools, agent w/ fake model, intent matrix, SSE, bilingual prompt)
cd apps/mobile && npm test                # 395 tests (money format, SSE parser, voice loop, card parity, renderers)
cd apps/mobile && npx tsc --noEmit -p .   # typecheck (no package.json script yet — run tsc directly)

# Live routing gate — real Gemini, real backend; run before a demo:
cd services/ai && uv run python scripts/ai-smoke.py --language both
```

### How to demo

1. Bring up Mongo, backend, AI service, Metro (table above); seed the world once.
2. Open the app in Expo Go — you land on Phone entry. Sign in as Ammi (or any seeded
   user) via OTP → PIN.
3. Walk `docs/DEMO-SCRIPT.md` in its printed order — Flow A (bank-aware send with the PIN in
   chat), B (saved recipient + bill), C (the Urdu switch), E (the whole bank as cards), F (the
   trusted contact and the scam call — needs a second simulator signed in as Bilal), then D
   (the classic layer).
4. To reset state mid-demo, re-run `npm run seed` in `services/backend` (idempotent) — note it
   wipes saved recipients and billers, so re-walk Flow A before Flow B.

> **Notes:** Mongo publishes on host port **27018** (container 27017) to avoid clashing
> with any locally installed MongoDB — the replica set is required for transactions.
> The mobile app reaches the host via `127.0.0.1` (iOS sim) / `10.0.2.2` (Android
> emulator); override with `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_AI_URL` for a real device.
> Statements PDFs are English-only regardless of the app's display language.

## Documents

| Document | What it is |
|---|---|
| `docs/PROPOSAL.md` | Submission-ready product + technical proposal: problem, safety model, what is built, architecture, honest limits, roadmap |
| `docs/DEMO-SCRIPT.md` | The bilingual pitch script — flow order, what you say, what the audience sees, presenter recovery notes |
| `docs/BLOCKERS.md` | Build blockers and the demo-time gotchas they left behind |
| `docs/plans/2026-09-01-payo-roadmap.md` | Cross-service contracts (REST API, SSE protocol, card schemas, seed world) and the phase/status index |
| `docs/plans/*.md` | Per-phase and per-version execution plans |

Design specs (each builds on the one before; anything a later spec does not mention stays as built):

| Spec | Scope |
|---|---|
| `docs/2026-09-01-payo-mvp-design.md` | The original product spec |
| `docs/2026-09-02-payo-revamp-design.md` | AI-first Home, phone-only auth, the design system |
| `docs/2026-09-03-payo-v3-recipients-bills-design.md` | Bank-aware sends, saved recipients and billers, in-chat PIN |
| `docs/2026-09-05-payo-v4-handsfree-voice-design.md` | The hands-free conversation loop |
| `docs/2026-09-05-payo-v5-full-ai-coverage-design.md` | Every classic action through the AI, card-only replies, Urdu voice |
| `docs/2026-09-06-payo-v6-guardian-scam-proactive-design.md` | Trusted contact, scam check-in, proactive greeting (+ the v6.1 owner amendments) |

QA reports (verification evidence, with screenshots beside each one):

| Report | Covers |
|---|---|
| `docs/qa/QA-REPORT.md`, `docs/qa/revamp/QA-REPORT.md` | Phases 1–6 and the revamp |
| `docs/qa/v3/QA-REPORT.md` | v3 acceptance + the multi-turn re-run |
| `docs/qa/v4/QA-REPORT.md` | Hands-free loop acceptance |
| `docs/qa/v5/QA-REPORT.md` | Full AI coverage, the live routing-gate history, Urdu voice |
| `docs/qa/v6/QA-REPORT.md` | Two-simulator guardian round-trip, scam check-in, and the **v6.1 addendum** (logos, spoken outcome, age-based rules) |

Design artboards: `docs/design/revamp-v1/*.dc.html`.

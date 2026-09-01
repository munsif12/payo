# PAYO — voice-first Urdu banking MVP

PAYO is an AI-first, voice-first banking demo for non-tech Urdu-speaking users. Tap the
mic, say what you want in Urdu ("بلال کو 1500 بھیجو"), and the agent understands,
gathers what's missing, and prepares the action — always behind a
**speak-aloud → tap-confirm → PIN** safety gate for anything that moves money. A full
classic wallet UI (tabs: home / activity / pay / more) covers every capability by hand.
Demo only: no real money movement, no payment gateways.

## What's inside

| Piece | Stack | Highlights |
|---|---|---|
| `apps/mobile` | Expo SDK 57 · TypeScript · expo-router · RTK Query · i18next | Urdu-first RTL UI (Noto Nastaliq), voice home w/ silence auto-stop recording, SSE chat with native cards, shared confirm→PIN→execute flow, bilingual ur/en toggle |
| `services/backend` | Node 20 · Express 4 · Mongoose 8 · TS · zod · pdfkit | All money movement; pending-action engine (PIN-gated, idempotent, 2-min expiry, atomic Mongo transactions); auth/OTP, transfers, bills, recharges, requests, pockets, cards, statements (PDF), QR, chat persistence; deterministic seed world; **56 jest tests** |
| `services/ai` | Python 3.12 · FastAPI · LangGraph · Gemini · Cartesia | The agent is *just another client*: 17 tools calling the backend with the user's JWT — write tools only ever create pending actions. Gemini native-audio in, Cartesia TTS out (silent stub without a key), SSE per contract; **24 pytest tests** |
| `scripts/mock-ai` | FastAPI | Offline/no-key demo fallback: same SSE contract, real backend actions, canned reasoning for the five demo utterances |

Docs: `docs/` — product spec, roadmap with all cross-service contracts, six phase plans,
`DEMO-SCRIPT.md` (bilingual pitch), `qa/QA-REPORT.md` (verification evidence),
`BLOCKERS.md`.

## Prerequisites

- Docker (Desktop) — MongoDB 7 as a single-node replica set
- Node 20+, `uv` (Python 3.12), Xcode and/or Android Studio for simulators

## Run

| What | Command |
|---|---|
| Mongo (replica set, host port **27018**) | `docker compose up -d mongo` |
| Seed the demo world | `cd services/backend && npm run seed` |
| Backend (:4000) | `cd services/backend && npm run dev` |
| AI service (:8000) | `cd services/ai && uv run uvicorn app.main:app --port 8000` |
| AI fallback without keys | `cd services/ai && uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai` |
| Mobile (Metro :8081) | `cd apps/mobile && npx expo start` → open in Expo Go on the iOS simulator (`i`) / Android emulator (`a`) |

Log in as **`ammi@payo.demo` / PIN `1234`** (five more users: bilal, sara.khan,
sara.malik, hamza, ayesha — same PIN). Then follow `docs/DEMO-SCRIPT.md`.

### API keys (`services/ai/.env`, gitignored)

```
GEMINI_API_KEY=...     # required for the live agent + Urdu audio transcription
CARTESIA_API_KEY=...   # optional; without it TTS is a silent stub (text+cards still work)
```

### Tests

```bash
cd services/backend && npm test     # 56 tests (money invariants, pending-action engine, e2e)
cd services/ai && uv run pytest     # 24 tests (tools, agent w/ fake model, SSE)
cd apps/mobile && npx jest          # unit tests (money format, SSE parser, urls)
```

> **Notes:** Mongo publishes on host port **27018** (container 27017) to avoid clashing
> with any locally installed MongoDB — the replica set is required for transactions.
> The mobile app reaches the host via `127.0.0.1` (iOS sim) / `10.0.2.2` (Android
> emulator); override with `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_AI_URL` for a real device.

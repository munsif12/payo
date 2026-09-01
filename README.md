# PAYO — voice-first Urdu banking MVP

PAYO is an AI-first, voice-first banking demo app for non-tech Urdu-speaking users.
Tap the mic, say what you want in Urdu ("بلال کو 1500 بھیجو"), and the AI agent
understands, gathers what's missing, and executes — always behind a
speak-aloud → tap-confirm → PIN safety gate for anything that moves money. A classic
tab-based wallet UI covers every capability by hand as well. Demo only: no real money
movement, no payment gateways.

## Prerequisites

- Docker (Desktop) — for MongoDB
- Node 20+
- uv (Python package manager; Python 3.12 managed by uv)
- Xcode (iOS simulator) and/or Android Studio (emulator)

## Run

| What | Command |
|---|---|
| Mongo | `docker compose up -d mongo` |
| Backend (:4000) | `cd services/backend && npm run dev` |
| AI service (:8000) | `cd services/ai && uv run uvicorn app.main:app --reload --port 8000` |
| Mobile | `cd apps/mobile && npx expo start` |
| Seed demo data | `cd services/backend && npm run seed` |

Docs: `docs/` (spec, roadmap with all cross-service contracts, phase plans).

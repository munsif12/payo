# PAYO — QA Report

**Date:** 2026-09-02 · **QA method:** Argent-driven UI automation on iOS simulator
(iPhone 17 Pro, iOS 26.5, Expo Go) and Android emulator (Pixel-class AVD, API 35,
Expo Go), against the live local stack (Mongo replica set in Docker on :27018,
backend :4000, AI service :8000, Metro :8081, seeded demo world).

**Update 2026-09-02 — live agent verified; see "Live-agent QA" at the end.** The mock-model caveat below applies to the original run only.

**Model caveat (original run):** `GEMINI_API_KEY` could not be copied into
`services/ai/.env` by the build agent (its permission system blocks reading
credential files — see `docs/BLOCKERS.md` for the one-line manual fix). All
conversational QA below therefore ran against `scripts/mock-ai/mock_ai.py` — a
scripted stand-in that serves the identical `/converse` SSE contract and calls the
**real backend** for every action (pending actions, balances, statements are genuine);
only the LLM reasoning is canned. The real LangGraph agent is covered by 24 pytest
tests with a fake-model harness and activates unchanged once the key is present.

## Hero flows (Definition of Done §4)

| Flow | iOS | Android | Evidence |
|---|---|---|---|
| (a) Voice "بلال کو 1500 بھیجو" → confirmation card → تصدیق → PIN → success → balance updated → in Activity | **PASS** (mic recorded, silence auto-stop, Urdu transcript rendered, card → PIN → success `PAYO-5SE7RFFAYG`) | **PASS** (typed variant; success `PAYO-AU9WN2VG33`) | `phase-5/ios-voice-transcript-card.png`, `ios-voice-flow-success.png`, `android-voice-flow-success.png`; balance drop visible in header; txn top of Activity (`phase-3/*activity*`) |
| (b) E-statement ask → confirm → statement card → PDF download | **PASS** — chat statement card w/ download (`phase-6/ios-chat-statement-card-ur.png`); classic flow: confirm dialog → generate → share sheet → rendered PDF (`phase-3/ios-statement-share.png`, `ios-statement-pdf.png`) | Classic statement screen not re-run on Android (same JS code path) — **PASS by parity, not directly evidenced** | see left |
| (c) Bill lookup + pay via classic UI (K-Electric `0400012345678`, ₨4,320) | **PASS** — lookup card, confirm, PIN, success `PAYO-B3T9HF936D`; re-pay correctly rejected (410 tested in backend suite) | Not re-run on Android (identical code path) | `phase-3/ios-bill-*.png` |
| (d) Two-Saras disambiguation chips | **PASS** — chips card rendered, tap sends chip text as new turn | Not re-run on Android | `phase-5/ios-two-saras-chips.png`, `ios-chip-tap-turn.png` |
| (e) English toggle run of (a) | **PASS** — profile toggle flips whole UI + existing chat cards to LTR English; English turn answered w/ balance card; English send turn produced English confirmation card | Toggle not re-run on Android | `phase-6/ios-english-cards.png`, `ios-english-balance-turn.png`, `phase-3/ios-english-home.png` |

Cross-device consistency: balances tracked correctly across both devices sharing one
backend (84,500 → … → 70,180 over the QA session, every step arithmetically verified).

## Classic layer (Phase 3 matrix)

| Area | iOS | Android |
|---|---|---|
| Login / logout / wrong-PIN error | PASS | PASS (+ wrong-PIN on execute: PASS) |
| Balance reveal | PASS | PASS |
| Activity list + filters + fresh txns | PASS | PASS |
| Send money (contact) + cancel path | PASS | PASS |
| Recharge (Jazz ₨500) | PASS | not re-run |
| Pocket deposit (no PIN, عمرہ فنڈ progress bar) | PASS | not re-run |
| Card reveal / freeze toggle | PASS (reveal) | not re-run |
| Statements generate/list/PDF | PASS | not re-run |

## Test suites (all green)

- backend: **56 tests / 19 suites** (jest + supertest + mongodb-memory-server ReplSet) — money invariants, pending-action lifecycle (idempotent, expiring, PIN-gated), all domains, seed, e2e smoke.
- ai: **24 tests** (pytest) — tool contracts, card golden shapes, agent graph w/ fake model, SSE order, chat persistence, TTS stub.
- mobile: **6 tests** (jest) — money format, backend/ai URL logic, SSE parser (incl. CRLF).

## Known limitations (honest list)

1. **Live Gemini agent unverified on-device** — key copy blocked (BLOCKERS.md). Mock-model runs cover the full UI/transport/backend path; agent logic covered by pytest only.
2. **TTS now live (2026-09-02)** — Cartesia key added; provider fixed to `sonic-3.6` (Urdu-capable) with a real Urdu voice, verified by one live synthesis. On-device audio playback of real speech has not yet been re-run (QA above predates the key). Account credit is minimal: utterances are capped at 400 chars, no retries, silent-stub fallback on any provider error.
3. **Voice input on simulator** — recording works (metering silence auto-stop verified), but the simulator microphone carried no intelligible speech; the transcript shown in QA came from the mock. Real-device voice needs the Gemini key + a phone.
4. **QR camera scan untestable in simulators** — paste-payload fallback works (signed payload verified by backend tests); camera path unexercised.
5. **Statement PDF is English-only** by design (Nastaliq shaping in pdfkit is unreliable); in-app views are Urdu.
6. **Android matrix is partial** (login, send+PIN, activity, converse flow); remaining screens share the exact JS code path with iOS but were not individually re-run.
7. Chat history persists via the backend when the real AI service runs; the mock server does not persist turns (`sessionId: "mock"`).
8. Mongo runs on host port **27018** (not the roadmap's original 27017) because this machine has a local standalone mongod on 27017 that would shadow the replica set; the roadmap was amended in the same commit.


## Live-agent QA (2026-09-02) — real Gemini + real Cartesia, iOS simulator

Stack: seeded Mongo (:27018), backend :4000, **real** AI service :8000 with
`GEMINI_API_KEY` + `CARTESIA_API_KEY`, Metro in watch mode, Expo Go on iPhone 17 Pro.
Voice input still can't be exercised in the simulator (no real speech), so the typed
fallback was used with **Roman-Urdu code-mixed input**, exactly as many real users type.

| Check | Result | Evidence |
|---|---|---|
| Stale session after reseed → app signs out to login (new guard) | **PASS** — cold start hit `/me`, got 401 `SESSION_EXPIRED`, landed on login | `phase-7-live-agent/ios-stale-session-signed-out.png` |
| Login امی (email + PIN pad) | PASS | — |
| Typed "Bilal ko 1500 rupees bhejo" → real agent resolves بلال احمد, calls `send_money`, renders confirmation card (~4 s) | **PASS** | `ios-live-agent-confirmation-card.png` |
| تصدیق → full-screen confirm (recipient, phone, amount) → تصدیق → PIN gate → 1234 → success `PAYO-PW46VCDQV2` | **PASS** | `ios-live-agent-confirm-screen.png`, `ios-live-agent-pin-gate.png`, `ios-live-agent-success.png` |
| Ledger: امی 8,300,000 → 8,150,000 paisa; بلال credited 150,000; pending action `completed` | **PASS** (verified in Mongo) | — |
| API-level real-agent turns: balance ("چوراسی ہزار پانچ سو روپے" + balance card), two-Saras disambiguation chips, last-month food spend (₨5,152, matches DB), last 3 transactions card | **PASS** | scripted runs, see BLOCKERS §1 |
| Cartesia Urdu TTS (Sonic 3.6, Zara) | **PASS** — real MP3 audio returned for Urdu replies (26–94 KB) | `docs/BLOCKERS.md` §2 |

Not re-run live: Android (same JS path as before), bill-pay and statement via chat with
the real model, on-device audio playback of the real voice (audio events flowed; the
simulator's speaker output was not captured). Cartesia account credit is minimal — keep
demo turns short; TTS is capped at 400 chars per reply with silent fallback on errors.

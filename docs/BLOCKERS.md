# PAYO Build Blockers

## 1. Gemini API key — RESOLVED 2026-09-02

SIA stores the key as `GOOGLE_API_KEY`, so the original one-liner (which grepped
`GEMINI_API_KEY`) appended nothing. Copied with a rename into gitignored
`services/ai/.env`. Live-agent runs then surfaced three real agent bugs, all fixed with
regression tests: (1) the model narrated "see the confirmation card" without calling
`send_money` — prompt tightened + a re-prompt guard when a card is promised but none
was produced; (2) Gemini 2.5 content blocks (with thinking signature) were stringified
into the reply and spoken aloud — proper text extraction; (3) no current date in the
system prompt, so "last month" resolved to an empty range — date injected. A fourth
bug was in the platform: the backend accepted validly-signed JWTs for users deleted by
a reseed (ghost sessions with empty data) — `requireAuth` now verifies the user exists
(401 `SESSION_EXPIRED`) and the app signs out on any 401 (REST and AI stream).

## 2. Cartesia key — RESOLVED 2026-09-02

Owner supplied a Cartesia key (in gitignored `services/ai/.env`). While wiring it, two
bugs in the never-exercised provider were found and fixed: it used `model_id="sonic-2"`
(no Urdu — Urdu arrived in Sonic 3.6) and iterated `tts.bytes()` without awaiting it.
Now: `sonic-3.6`, curated Urdu voice (Zara) / English voice (Skylar), 400-char
per-utterance cap, SDK retries disabled, and any provider failure falls back to the
silent stub. Verified live with a single 12-character Urdu synthesis (26 KB MP3).
**The account balance is very low — keep demo turns short; the cap and no-retry
rules exist to protect it.**

## 3. Resolved along the way (no action needed)

- **Host port 27017 shadowed** by a pre-existing local standalone `mongod` (belongs to
  another project; not killed). PAYO's Mongo moved to host port **27018**; roadmap,
  README, compose and backend config updated in the same commit.
- **Expo Go SDK 57 dropped `expo-av`'s native module** → voice recording/playback
  reimplemented on `expo-audio`.
- **sse-starlette emits CRLF SSE frames** → mobile SSE parser normalizes CRLF
  (regression-tested).
- **`~/.cache` owned by root** on this machine → mongodb-memory-server binaries cache
  in `services/backend/node_modules/.cache`.

## 4. Demo-time gotchas (not blockers, but they will bite)

- **The backend does not read `.env`.** `GUARDIAN_COOLING_MS=0` (instant guardian changes for
  the demo) must be passed in the environment: `GUARDIAN_COOLING_MS=0 npm run dev`. Without it
  the production default of 24 h applies and Flow F stalls.
- **`npm run seed` is required after every pull.** The seed now carries institution/biller
  domains and dates of birth; an older seeded DB has neither, so logos and the age-based risk
  rules behave wrongly. Reseeding also wipes saved recipients and billers — the demo script
  re-creates them.
- **Cartesia balance is low** (see §2). Every assistant turn synthesizes speech; a noisy room
  keeps the hands-free loop alive and each turn costs a Gemini call plus a synthesis. Mute the
  Mac's input between flows, or set `TTS_ENABLED=false` while rehearsing.
- **Routing is probabilistic.** Run `uv run python scripts/ai-smoke.py --language both` in
  `services/ai` before presenting; a full run still has about one intermittent miss.

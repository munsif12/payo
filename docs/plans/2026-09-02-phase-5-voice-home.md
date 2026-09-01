# PAYO Phase 5 — Voice Home Implementation Plan

> Contracts: roadmap Contract 2 (SSE `/converse`), Contract 3 (cards). AI service base
> URL: port 8000 on the same host logic as the backend (127.0.0.1 iOS / 10.0.2.2 Android).

**Goal:** The home tab becomes the real voice-first surface: mic tap → record →
silence auto-stop → `/converse` (audio) → transcript + streamed reply + native cards →
TTS playback; typed fallback and suggestion tiles feed the same loop; the
`confirmation` card routes into the existing confirm→PIN→execute flow; `contact_chips`
taps send the chip text back as a text turn.

**Pieces (apps/mobile):**
- `src/lib/aiUrl.ts` — AI base URL per platform (+ env override `EXPO_PUBLIC_AI_URL`).
- `src/lib/sse.ts` — tiny SSE-over-XHR client (`postSse(url, {headers, body|formData, onEvent})`)
  since RN fetch cannot stream; parses `event:`/`data:` frames incrementally. Jest-tested
  with a scripted XHR fake.
- `src/voice/useRecorder.ts` — expo-av recording with metering; auto-stop after
  ~1.5s of silence (metering < -35 dB) or 15 s cap; returns file URI + mime.
- `src/voice/useConverse.ts` — one hook owning the conversation state machine:
  `messages: {role, text, cards}[]`, `status: idle|recording|thinking|speaking`,
  `sendText(text)`, `sendAudio(uri)`; wires SSE events (transcript/token/card/audio/done/error),
  plays TTS via expo-av `Audio.Sound`, persists nothing locally (backend owns history).
- `src/components/cards/CardView.tsx` — renders every Contract 3 card:
  `confirmation` → summary + amount + big تصدیق button → holds action-shaped object and
  routes to `/confirm/[actionId]` (reusing Phase 3 flow; the card carries all fields the
  confirm screen needs) + منسوخ; `contact_chips` → tappable pills calling `sendText(chip)`;
  `balance`/`bill`/`pocket`/`statement` (with download via existing openPdf helper)/
  `transactions` (compact rows)/`success`.
- `app/(tabs)/index.tsx` — rebuild: transcript FlatList (bubbles + cards), mic button with
  recording/thinking states (pulse/red stop), keyboard-icon toggle for typed input,
  suggestion tiles → `sendText(t(key))`, error events → Urdu error bubble.

**Testing:** jest for `sse.ts` parser and confirmation-card→action mapping.
Device verification via Argent (typed turn; mic tap smoke — sim mic may be silent, noted
in QA). Without GEMINI_API_KEY the AI service answers with an error event; UI must show
it as a graceful Urdu bubble (proof screenshot) — live-agent proof deferred to Phase 6 +
BLOCKERS.md if the key still hasn't been provided.

## Tasks
- [x] Task 1: `aiUrl` + `sse.ts` + jest tests green. Commit `feat(mobile): sse client for ai service`.
- [x] Task 2: `useRecorder` + `useConverse` + CardView (all card kinds) + confirm-card routing. Commit `feat(mobile): converse state machine + native cards`.
- [x] Task 3: voice home rebuild (transcript, mic states, typed fallback, tiles). Commit `feat(mobile): voice-first home`.
- [x] Task 4: Argent verification both platforms — typed turn shows user bubble + (agent reply | graceful no-key bubble); chips/card render path exercised via mocked screenshots if no key. Screenshots → `docs/qa/phase-5/`. Roadmap Phase 5 → done. Commit `feat(mobile): phase 5 complete`.

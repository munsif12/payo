# PAYO v4 — Hands-free conversation (no tap per turn)

**Date:** 2026-09-05 · **Status:** approved in conversation (owner) · **Builds on:** v3
(`2026-09-03-payo-v3-recipients-bills-design.md`). Everything not mentioned here stays as built.

## 1. Product change

Today the mic must be tapped before every spoken turn (it already auto-stops on silence).
After this change, **one tap starts a conversation that stays live**: listen → send →
assistant speaks → listen again, until the user ends it or stops replying. The user only
touches the screen to end the conversation, to interrupt the assistant, or to enter a PIN.

Rules the user will feel:

1. **Tap the mic once** → the app listens. Pause when done speaking → the turn is sent.
2. **The assistant speaks, then listens again by itself.** No tap.
3. **Interrupt by tapping** the "Speaking… tap to interrupt" bar → it stops talking and
   listens immediately. (Voice barge-in is out of scope: no echo cancellation in this stack,
   so an open mic during playback would transcribe the assistant's own voice.)
4. **Silence ends it.** No speech for ~6 s → that turn is skipped; two skipped turns in a
   row → the conversation ends quietly. Tapping the X ends it at once.
5. **PIN is never spoken.** When the PIN sheet opens, listening pauses; it resumes after the
   sheet closes (success or cancel). PIN audio never reaches the AI service.
6. **Typing ends the conversation.** Sending a typed message while live switches back to
   tap-per-turn (the user changed modality). Tapping a suggestion card while live keeps it live.
7. Backgrounding the app or leaving the Home tab ends the conversation (no hot mic).

## 2. Mobile design (apps/mobile — the only service that changes)

### 2.1 Loop state machine — `src/voice/voiceLoopReducer.ts` (pure, no RN imports)

```ts
export type VoiceLoopMode = 'off' | 'listening' | 'thinking' | 'speaking' | 'paused';
export interface VoiceLoopState {
  mode: VoiceLoopMode;
  silentTurns: number;          // consecutive listening windows with no speech
  resumeTo: 'listening' | null; // where `resume` returns after `pause`
  endedReason: 'user' | 'silence' | 'error' | 'typed' | 'left' | null; // for the ended hint
}
export type VoiceLoopEvent =
  | { type: 'start' }                     // mic tap while off
  | { type: 'stop'; reason: 'user' | 'typed' | 'left' }
  | { type: 'sent' }                      // a clip with speech, or a suggestion tap, went to /converse
  | { type: 'noSpeech' }                  // listening window closed without speech
  | { type: 'audioStarted' }
  | { type: 'audioEnded' }                // playback finished (or safety cap)
  | { type: 'turnDone' }                  // SSE done and no audio ever started (text-only turn)
  | { type: 'interrupt' }                 // tap while speaking
  | { type: 'pause' }                     // PIN sheet opened
  | { type: 'resume' }                    // PIN sheet closed
  | { type: 'error' };
```

Transitions (anything not listed is a no-op returning the same state):

| from | event | to | notes |
|---|---|---|---|
| off | start | listening | silentTurns=0, endedReason=null |
| listening | sent | thinking | silentTurns=0 |
| listening | noSpeech | listening / off | silentTurns+1; off with reason `silence` when it reaches `MAX_SILENT_TURNS` |
| thinking | audioStarted | speaking | |
| thinking | turnDone | listening | text-only reply |
| speaking | audioEnded | listening | |
| speaking | interrupt | listening | the hook stops the player |
| listening / thinking / speaking | pause | paused | resumeTo=listening |
| paused | resume | listening | |
| any live | stop | off | endedReason=reason |
| any live | error | off | endedReason=error |
| off | sent | off | a plain tap-per-turn send; the loop stays off |

Constants in `src/voice/loopConfig.ts` (unit-tested for the documented values):

| name | value | meaning |
|---|---|---|
| `PRE_SPEECH_TIMEOUT_MS` | 6000 | mic open, nothing heard yet → close the window |
| `POST_SPEECH_SILENCE_MS` | 1200 | speech heard, then quiet this long → send |
| `SPEECH_THRESHOLD_DB` | -30 | peak metering must reach this for a clip to count as speech |
| `SILENCE_DB` | -35 | below this is silence (unchanged) |
| `MAX_CLIP_MS` | 15000 | hard cap per clip (unchanged) |
| `REARM_DELAY_MS` | 300 | gap after playback ends before the mic opens (audio tail) |
| `MAX_SILENT_TURNS` | 2 | consecutive no-speech windows before the loop ends |

### 2.2 Recorder — `src/voice/useRecorder.ts`

- Replace the single warm-up + silence rule with the two-timer rule above. The decision
  is a pure helper `src/voice/silence.ts` → `silenceDecision({ now, startedAt, level,
  hadSpeech, silenceSince, cfg })` returning `'continue' | 'stop'` and the updated
  `hadSpeech`/`silenceSince`; the hook just applies it. Unit-tested.
- `hadSpeech` = peak metering ≥ `SPEECH_THRESHOLD_DB` at any point in the clip.
- `onFinished` now receives `{ uri, mime, hadSpeech }`. Callers that ignore `hadSpeech`
  keep working.
- Same rule for manual (loop-off) taps: it removes the "tapped and waited 2 s" dead time.

### 2.3 Player — `src/voice/useConverse.ts`

- `useConverse(opts?: { onSpeechEnd?: () => void; onTurnDone?: () => void; onError?: () => void })`.
  - `onSpeechEnd` fires once per turn when playback finishes (`didJustFinish`) or when the
    safety cap fires.
  - `onTurnDone` fires on SSE `done` when no `audio` event arrived in that turn.
  - `onError` fires on the `error` event or `onError` of the stream.
- **Remove the fixed 4 s "speaking" timeout.** It truncates real replies (>4 s) and would
  re-open the mic mid-sentence. Replace with a cap derived from the player: once
  `duration` is known, `speakSafetyMs(durationMs) = durationMs + 1500`; while unknown,
  `SPEAK_SAFETY_UNKNOWN_MS = 30000`. Pure helper in `src/voice/speakSafety.ts`, unit-tested.
- New `interrupt()`: stops and removes the player, sets status `idle`, does **not** fire
  `onSpeechEnd` (the loop hook dispatches `interrupt` itself).
- Everything else (SSE handling, inFlightGate, sign-out on auth errors) unchanged.

### 2.4 Orchestrator — `src/voice/useVoiceLoop.ts`

`useVoiceLoop({ recorder, converse, pinSheetOpen })` → `{ mode, endedReason, start, stop,
interrupt, onTextSend }`. Owns the reducer and these effects:

- `mode === 'listening'`: after `REARM_DELAY_MS`, call `recorder.start()` (guard: not if
  the mode changed during the delay; stop the player first).
- recorder `onFinished({ hadSpeech })`: `hadSpeech` → `converse.sendAudio(uri)` +
  dispatch `sent`; else dispatch `noSpeech` and **do not send** (no Gemini call).
- `converse.status === 'speaking'` → `audioStarted`; `onSpeechEnd` → `audioEnded`;
  `onTurnDone` → `turnDone`; `onError` → `error`.
- `pinSheetOpen` true → `pause`; false again → `resume` (only if paused).
- `AppState` leaves `active` → `stop('left')`; screen blur (`useFocusEffect` cleanup) →
  `stop('left')`; the recorder's own unmount cleanup still applies.
- `stop()` also stops any recording in progress and interrupts playback.
- `onTextSend(text)`: if live → `stop('typed')`; then `converse.sendText(text)`.
- Suggestion-card tap while live: `converse.sendText(intent)` + `sent` (stays live).

`PinSheetProvider` exposes `isOpen: boolean` (`action != null`) on its context so the loop
can pause; no other PIN changes.

### 2.5 UI — `Composer`, new `VoiceStatusBar`, Home

- `Composer`: prop `listening` → `live` (mic shows the navy X while live; amber breathing
  mic while off). No other visual change.
- `src/ui/VoiceStatusBar.tsx` (44 pt row above the composer, only rendered while live):
  - listening → `ListeningRings` + "Listening…"
  - thinking → `TypingDots` + "Thinking…"
  - speaking → `WaveBars` + "Speaking… tap to interrupt" — the whole row is the tap target
  - paused → "Paused — finish the PIN"
- Home hint line (below the composer): while live, `home.voice.hintLive` ("Just pause when
  you're done — tap X to end"); after an automatic end, `home.voice.ended` ("Conversation
  ended — tap the mic to start again") until the next tap.
- i18n keys (en + ur): `home.voice.listening`, `home.voice.thinking`,
  `home.voice.speakingTap`, `home.voice.paused`, `home.voice.hintLive`, `home.voice.ended`.
  Existing `home.hint.listeningFootnote` becomes "Just pause when you're done".
- Motion: existing primitives only; reduced motion already handled inside them.
- Accessibility: the status bar has `accessibilityRole="button"` only while speaking, with a
  label matching its text; ≥44 pt.

## 3. Out of scope (follow-ups, not this change)

- Voice barge-in (needs echo cancellation) and streaming duplex (Gemini Live / WebSocket).
- Auto-listening when Home opens.
- A spoken "yes" auto-opening the PIN sheet (today the assistant asks the user to confirm on
  the card; the tap on the card opens the sheet). Would need an AI-service card kind.
- Any backend or AI-service change. None is needed.

## 4. Acceptance

Unit (jest + tsc): reducer covers every row of the table plus the silent-turn cap and
pause/resume; `silenceDecision` covers pre-speech timeout, post-speech silence, speech
detection; `speakSafetyMs` covers known/unknown duration; i18n parity.

Simulator (no microphone available — the recorder hears silence):

1. Tap mic → status bar "Listening…", mic shows X → after ~6 s it re-arms once → after
   ~6 s more the loop ends with the "Conversation ended" hint. No `/converse` call was made.
2. Tap mic → tap the "Check my balance" suggestion → "Thinking…" → "Speaking… tap to
   interrupt" (with TTS on) → tap it → playback stops, "Listening…" within ~300 ms.
3. Tap mic → type a message → the loop ends (`typed`), the message is sent normally.
4. Tap mic → switch to the Wallet tab → loop ends, no recording continues (mic indicator
   gone).
5. The 4 s truncation is gone: a long reply keeps "Speaking…" until playback ends.

Physical device (owner, Expo Go): full spoken round-trips; confirm 1.2 s / 6 s feel right
for an unhurried speaker. Timings live in one file so they can be tuned without a code
change elsewhere.

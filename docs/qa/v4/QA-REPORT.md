# PAYO v4 QA — Hands-free conversation

**Date:** 2026-09-05 · **Spec:** `docs/2026-09-05-payo-v4-handsfree-voice-design.md` (§4
acceptance) · **Device:** iPhone 17 Pro simulator (iOS 26.5), Expo Go, driven via Argent.
**Stack:** `payo-mongo` (27018), `services/backend` (4000), `services/ai` (8000, real Gemini +
Cartesia, TTS on), Metro (8081). User: Ammi Jaan (`+923001110001`).

Important discovery: **the iOS simulator forwards the Mac's microphone**, so real speech
works on the simulator (earlier QA reports assumed it did not). Room conversation was picked
up during the first run — see "Live findings" — which is why the 12-turn cap (spec rule 8)
was added mid-cycle.

## Gates

| Gate | Result |
|---|---|
| `npx jest` (apps/mobile) | 18 suites / 99 tests passed |
| `npx tsc --noEmit` | clean |
| Independent review | Changes required (2 blockers, 3 should-fix, 2 nits) → all fixed → scoped re-review **Approved** |

## Acceptance (spec §4, simulator)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Tap mic → "Listening…" → re-arms once → ends by itself with the "Conversation ended" hint; no `/converse` call | **PASS** — ended at 13.2 s; `/converse` count unchanged (5 → 5) | `01-silence-ended.png` |
| 2 | Tap mic → suggestion → "Thinking…" → "Speaking… tap to interrupt" → tap → playback stops, "Listening…" returns | **PASS** — "Listening…" visible on the very next frame after the tap | `02-live-thinking-x-in-mic-slot.png`, `02-after-interrupt-listening.png` |
| 3 | Type a message while live → loop ends (`typed`), message sent normally | **PASS** — amber mic back, "Hi" sent and answered | `03-typed-ends-loop.png` |
| 4 | Switch to the Wallet tab while live → loop ends, no recording continues | **PASS** — "Conversation ended" on return to Home, X gone | (in the run log) |
| 5 | The 4 s truncation is gone: a long reply keeps "Speaking…" until playback ends | **PASS** — "Speaking… tap to interrupt" stayed visible 8.3 s for a ~100-character reply, then re-armed | `05-long-reply-after-x.png` |

Hands-free round-trip (unplanned, from room audio during the first run): clip with speech →
sent → assistant replied and spoke → "Listening…" returned with no tap → next clip sent. The
loop as designed works end to end with real speech.

## Live findings (fixed in the same cycle)

1. **X button rendered below the composer** while live, with an empty amber ring left in the
   mic slot (`00-defect-x-displaced-before-fix.png`). `ListeningRings` and the X pressable
   were stacked in normal flow. Fixed: rings wrapped in `StyleSheet.absoluteFill` +
   `pointerEvents="none"`; the X now occupies the mic's 64 pt slot (`02-live-thinking-x-in-mic-slot.png`).
2. **Runaway loop on room noise.** Any audible speech keeps the conversation alive; in a noisy
   room `MAX_SILENT_TURNS` never triggers and every turn costs a Gemini call + a Cartesia
   synthesis. Fixed: `MAX_AUTO_TURNS = 12` — the 12th reply is still spoken, then the loop
   ends with "Conversation paused after 12 turns — tap the mic to continue".

## Review findings (fixed before acceptance)

| Sev | Finding | Fix |
|---|---|---|
| BLOCKER | PIN sheet opening did not stop an in-flight recording; PIN-time audio could reach `/converse` | pause effect flips `modeRef` to `paused`, aborts the recorder, interrupts playback; the flushed clip is dropped by the send gate |
| BLOCKER | `stop()` awaited `recorder.stop()`, whose late `onFinished` still sent the clip | `modeRef = 'off'` set synchronously before the await; `onRecordingFinished` sends only while `modeRef === 'listening'` |
| SHOULD | `AppState !== 'active'` included iOS `inactive` (permission dialog, Control Center) → spurious end on first start | only `'background'` ends the loop |
| SHOULD | Speak-safety cap armed once from the first status update; a buffering stall could fire it over live audio | re-armed on every status update from `duration − currentTime + 1.5 s`; 30 s ceiling while not playing; `finished` latch |
| SHOULD | Re-arm effect cleanup cleared the timer but not a recorder it had already started | cleanup aborts the recorder when this effect started it |
| NIT | `loopRef.current` assigned during render | moved into `useEffect` |
| NIT | Reducer tests missing `paused` no-ops and `paused + error` | added |

## Not verified here

- Feel of the timings (1.2 s post-speech, 6 s pre-speech) for an unhurried older speaker —
  needs a person speaking naturally, on the simulator (Mac mic) or a phone. Both values live
  in `apps/mobile/src/voice/loopConfig.ts`.
- Android.
- A full spoken money flow through the PIN pause (pause/resume was verified by review and
  tests, not by a live PIN entry in this run).

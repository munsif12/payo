import { silenceDecision, defaultSilenceConfig, type SilenceInput } from '../silence';
import { MAX_CLIP_MS, POST_SPEECH_SILENCE_MS, PRE_SPEECH_TIMEOUT_MS } from '../loopConfig';

const T0 = 1_000_000;
const call = (over: Partial<SilenceInput>) => silenceDecision({
  now: T0, startedAt: T0, level: -60, hadSpeech: false, silenceSince: null, ...over,
});

test('quiet mic keeps listening until the pre-speech timeout', () => {
  expect(call({ now: T0 + PRE_SPEECH_TIMEOUT_MS - 1 }).decision).toBe('continue');
  const r = call({ now: T0 + PRE_SPEECH_TIMEOUT_MS });
  expect(r.decision).toBe('stop');
  expect(r.hadSpeech).toBe(false);
});

test('a level at the speech threshold latches hadSpeech', () => {
  const r = call({ now: T0 + 500, level: defaultSilenceConfig.speechThresholdDb });
  expect(r.hadSpeech).toBe(true);
  expect(r.decision).toBe('continue');
});

test('a level below the speech threshold does not latch hadSpeech', () => {
  expect(call({ now: T0 + 500, level: defaultSilenceConfig.speechThresholdDb - 1 }).hadSpeech).toBe(false);
});

test('hadSpeech stays latched once set, even while quiet', () => {
  expect(call({ now: T0 + 500, level: -80, hadSpeech: true }).hadSpeech).toBe(true);
});

test('after speech, the pre-speech timeout no longer applies', () => {
  const r = call({ now: T0 + PRE_SPEECH_TIMEOUT_MS + 1000, level: -10, hadSpeech: true });
  expect(r.decision).toBe('continue');
});

test('after speech, a quiet sample opens the silence run', () => {
  const r = call({ now: T0 + 2000, level: -80, hadSpeech: true });
  expect(r.decision).toBe('continue');
  expect(r.silenceSince).toBe(T0 + 2000);
});

test('after speech, quiet for the post-speech window stops the clip', () => {
  const since = T0 + 2000;
  expect(call({
    now: since + POST_SPEECH_SILENCE_MS - 1, level: -80, hadSpeech: true, silenceSince: since,
  }).decision).toBe('continue');
  expect(call({
    now: since + POST_SPEECH_SILENCE_MS, level: -80, hadSpeech: true, silenceSince: since,
  }).decision).toBe('stop');
});

test('speaking again clears the silence run', () => {
  const r = call({ now: T0 + 3000, level: -20, hadSpeech: true, silenceSince: T0 + 2000 });
  expect(r.decision).toBe('continue');
  expect(r.silenceSince).toBeNull();
});

test('the max-clip cap stops a clip even mid-speech', () => {
  const r = call({ now: T0 + MAX_CLIP_MS, level: -5, hadSpeech: true });
  expect(r.decision).toBe('stop');
  expect(r.hadSpeech).toBe(true);
});

test('a custom config overrides the defaults', () => {
  const cfg = { ...defaultSilenceConfig, preSpeechTimeoutMs: 100 };
  expect(call({ now: T0 + 150, cfg }).decision).toBe('stop');
});

test('with a noisy room, quiet means back near the noise floor', () => {
  // Room floor −44 dB: the fixed −48 floor would never be reached, so after speech
  // (−30) a level of −40 (just above the floor) must already count as quiet.
  const afterSpeech = silenceDecision({ now: 2000, startedAt: 0, level: -40, hadSpeech: true, silenceSince: null, noiseFloorDb: -44 });
  expect(afterSpeech.silenceSince).toBe(2000);
  const stopped = silenceDecision({ now: 3300, startedAt: 0, level: -40, hadSpeech: true, silenceSince: 2000, noiseFloorDb: -44 });
  expect(stopped.decision).toBe('stop');
  // And a level barely above the floor is not speech.
  expect(silenceDecision({ now: 500, startedAt: 0, level: -36, hadSpeech: false, silenceSince: null, noiseFloorDb: -44 }).hadSpeech).toBe(false);
  expect(silenceDecision({ now: 500, startedAt: 0, level: -33, hadSpeech: false, silenceSince: null, noiseFloorDb: -44 }).hadSpeech).toBe(true);
});

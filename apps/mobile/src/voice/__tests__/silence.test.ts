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
  const r = call({ now: T0 + PRE_SPEECH_TIMEOUT_MS + 5000, level: -10, hadSpeech: true });
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

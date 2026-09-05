import { speakSafetyMs } from '../speakSafety';
import { SPEAK_SAFETY_PAD_MS, SPEAK_SAFETY_UNKNOWN_MS } from '../loopConfig';

test('an unknown duration falls back to the generous ceiling', () => {
  expect(speakSafetyMs()).toBe(SPEAK_SAFETY_UNKNOWN_MS);
  expect(speakSafetyMs(null)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
  expect(speakSafetyMs(undefined)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
});

test('a known duration is padded', () => {
  expect(speakSafetyMs(4000)).toBe(4000 + SPEAK_SAFETY_PAD_MS);
  expect(speakSafetyMs(30000)).toBe(30000 + SPEAK_SAFETY_PAD_MS);
});

test('a zero, negative or non-finite duration is treated as unknown', () => {
  expect(speakSafetyMs(0)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
  expect(speakSafetyMs(-1)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
  expect(speakSafetyMs(Number.NaN)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
  expect(speakSafetyMs(Number.POSITIVE_INFINITY)).toBe(SPEAK_SAFETY_UNKNOWN_MS);
});

test('a long reply is no longer truncated at 4 s', () => {
  expect(speakSafetyMs(12000)).toBeGreaterThan(12000);
});

import {
  PRE_SPEECH_TIMEOUT_MS, POST_SPEECH_SILENCE_MS, SPEECH_THRESHOLD_DB, SILENCE_DB,
  MAX_CLIP_MS, REARM_DELAY_MS, MAX_SILENT_TURNS, MAX_AUTO_TURNS,
  SPEAK_SAFETY_UNKNOWN_MS, SPEAK_SAFETY_PAD_MS,
} from '../loopConfig';

test('loop constants match the documented spec values', () => {
  expect(PRE_SPEECH_TIMEOUT_MS).toBe(6000);
  expect(POST_SPEECH_SILENCE_MS).toBe(1200);
  expect(SPEECH_THRESHOLD_DB).toBe(-30);
  expect(SILENCE_DB).toBe(-35);
  expect(MAX_CLIP_MS).toBe(15000);
  expect(REARM_DELAY_MS).toBe(300);
  expect(MAX_SILENT_TURNS).toBe(2);
  expect(MAX_AUTO_TURNS).toBe(12);
});

test('speech threshold sits above the silence floor', () => {
  expect(SPEECH_THRESHOLD_DB).toBeGreaterThan(SILENCE_DB);
});

test('safety-cap constants', () => {
  expect(SPEAK_SAFETY_UNKNOWN_MS).toBe(30000);
  expect(SPEAK_SAFETY_PAD_MS).toBe(1500);
});

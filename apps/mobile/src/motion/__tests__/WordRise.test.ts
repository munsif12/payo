import { wordDelays, wordRiseEnd, splitWords, WORD_TRANSLATE_Y } from '../wordRiseSchedule';
import { WORD_STEP, D_ENTER } from '../config';

test('splitWords splits on whitespace and drops the empties', () => {
  expect(splitWords('Assalam o Alaikum, Ammi.')).toEqual(['Assalam', 'o', 'Alaikum,', 'Ammi.']);
  expect(splitWords('  double   spaced \n line ')).toEqual(['double', 'spaced', 'line']);
  expect(splitWords('')).toEqual([]);
  expect(splitWords('   ')).toEqual([]);
});

test('wordDelays staggers WORD_STEP apart from the offset', () => {
  expect(wordDelays(4)).toEqual([0, WORD_STEP, WORD_STEP * 2, WORD_STEP * 3]);
  expect(wordDelays(3, 200)).toEqual([200, 200 + WORD_STEP, 200 + WORD_STEP * 2]);
  expect(wordDelays(0, 200)).toEqual([]);
  expect(wordDelays(-2)).toEqual([]);
});

test('wordRiseEnd is when the last word has landed — the sheet settle offset', () => {
  expect(wordRiseEnd(4)).toBe(WORD_STEP * 3 + D_ENTER);
  expect(wordRiseEnd(1, 100)).toBe(100 + D_ENTER);
  // No words: the sheet still settles, straight after the offset.
  expect(wordRiseEnd(0, 100)).toBe(100 + D_ENTER);
});

test('words travel the same 12 pt as every other entrance', () => {
  expect(WORD_TRANSLATE_Y).toBe(12);
});

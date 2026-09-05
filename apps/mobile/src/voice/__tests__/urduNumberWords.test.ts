import { urduNumberWords, MAX_SUPPORTED } from '../urduNumberWords';

// The same table services/ai/tests/test_urdu_numbers.py asserts on. If a case
// here and a case there ever disagree, the app and the AI service are speaking
// two different Urdus and one of them is wrong.
test.each([
  [0, 'صفر'],
  [7, 'سات'],
  [15, 'پندرہ'],
  [100, 'ایک سو'],
  [1500, 'پندرہ سو'],
  [4320, 'چار ہزار تین سو بیس'],
  [81800, 'اکیاسی ہزار آٹھ سو'],
  [250000, 'دو لاکھ پچاس ہزار'],
  [9999999, 'ننانوے لاکھ ننانوے ہزار نو سو ننانوے'],
])('%i is spelled out as the Python port spells it', (n, words) => {
  expect(urduNumberWords(n)).toBe(words);
});

test('the colloquial hundreds rule only covers 1100-1999', () => {
  expect(urduNumberWords(1099)).toBe('ایک ہزار ننانوے');
  expect(urduNumberWords(1100)).toBe('گیارہ سو');
  expect(urduNumberWords(1999)).toBe('انیس سو ننانوے');
  expect(urduNumberWords(2000)).toBe('دو ہزار');
});

test('2,550 — the sentence the spec spells out by hand', () => {
  expect(urduNumberWords(2550)).toBe('دو ہزار پانچ سو پچاس');
});

test('out of range, negative and non-integer amounts are not spelled out', () => {
  expect(urduNumberWords(MAX_SUPPORTED + 1)).toBeNull(); // 1 crore
  expect(urduNumberWords(-5)).toBeNull();
  expect(urduNumberWords(15.5)).toBeNull();
  expect(urduNumberWords(NaN)).toBeNull();
});

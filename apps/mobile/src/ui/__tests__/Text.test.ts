import { textDirectionFor } from '../Text';

test('money variant is always ltr, even in Urdu', () => {
  expect(textDirectionFor('money', true)).toBe('ltr');
  expect(textDirectionFor('money', false)).toBe('ltr');
});

test('non-money variants follow the language direction', () => {
  expect(textDirectionFor('body', true)).toBe('rtl');
  expect(textDirectionFor('body', false)).toBe('ltr');
  expect(textDirectionFor('hl', true)).toBe('rtl');
  expect(textDirectionFor('cap', false)).toBe('ltr');
});

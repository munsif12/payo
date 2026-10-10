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


// v8 Urdu QA: Latin-only strings keep the Latin face; Nastaliq keeps its line height.
import { isLatinOnly, urduLineHeight } from '../Text';
import { type } from '../../theme/tokens';

test('Latin-only text (amounts, references, digits) is detected so it keeps the Latin face in Urdu', () => {
  expect(isLatinOnly('₨2,000')).toBe(true);
  expect(isLatinOnly('2000')).toBe(true);
  expect(isLatinOnly('PAYO-96XSZXJ36G')).toBe(true);
  expect(isLatinOnly('فیس ₨0 · کل رقم ₨2,000')).toBe(false);
  expect(isLatinOnly('ابو')).toBe(false);
  expect(isLatinOnly('')).toBe(false);
});

test('an explicit Latin lineHeight never shrinks Nastaliq below its 1.9× minimum', () => {
  expect(urduLineHeight(12, 16)).toBe(12 * type.urduLineHeightMult);
  expect(urduLineHeight(12, 40)).toBe(40);
  expect(urduLineHeight(26, undefined)).toBe(26 * type.urduLineHeightMult);
});

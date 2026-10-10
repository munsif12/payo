import { normalizeRelationQuery, relationAliases } from '../relations';

test('family words map to every nickname that names the same relationship', () => {
  expect(relationAliases('father')).toEqual(expect.arrayContaining(['abbu', 'abba', 'baba', 'papa', 'ابو', 'والد']));
  expect(relationAliases('Abbu')).toEqual(expect.arrayContaining(['father', 'dad']));
  expect(relationAliases('ammi')).toEqual(expect.arrayContaining(['mother', 'mom', 'امی', 'والدہ']));
  expect(relationAliases('والدہ')).toEqual(expect.arrayContaining(['ammi', 'mother']));
  expect(relationAliases('bhai')).toEqual(expect.arrayContaining(['brother', 'بھائی']));
});

test('"my father", "mere abbu", "abbu jaan" and "میرے ابو" all normalise to the bare word', () => {
  expect(normalizeRelationQuery('my father')).toBe('father');
  expect(normalizeRelationQuery('Mere Abbu')).toBe('abbu');
  expect(normalizeRelationQuery('Abbu Jaan')).toBe('abbu');
  expect(normalizeRelationQuery('میرے ابو')).toBe('ابو');
  expect(relationAliases('my mother')).toContain('ammi');
});

test('a plain nickname that is not a relationship is left alone', () => {
  expect(relationAliases('Munsif')).toBeNull();
  expect(relationAliases('')).toBeNull();
  expect(relationAliases('0300')).toBeNull();
});

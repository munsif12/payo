import en from '../en.json';
import ur from '../ur.json';

test('en.json and ur.json have identical key sets', () => {
  const enKeys = Object.keys(en).sort();
  const urKeys = Object.keys(ur).sort();
  expect(urKeys).toEqual(enKeys);
});

test('every key has a non-empty value in both languages', () => {
  for (const key of Object.keys(en)) {
    expect((en as Record<string, string>)[key].length).toBeGreaterThan(0);
    expect((ur as Record<string, string>)[key].length).toBeGreaterThan(0);
  }
});

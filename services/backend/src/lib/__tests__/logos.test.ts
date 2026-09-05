import { logoUrlFor } from '../logos';

test('logoUrlFor builds a Google favicon URL for the given domain', () => {
  expect(logoUrlFor('payo.app')).toBe('https://www.google.com/s2/favicons?domain=payo.app&sz=128');
  expect(logoUrlFor('hbl.com')).toBe('https://www.google.com/s2/favicons?domain=hbl.com&sz=128');
});

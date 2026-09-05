import { pickLogoSource, LOGO_OVERRIDES, type LogoOverrides } from '../logoOverrides';

const overrides: LogoOverrides = { hbl: 101, easypaisa: 102, zero: 0 };

test('no code and no url means initials', () => {
  expect(pickLogoSource(overrides, undefined, undefined)).toBeNull();
  expect(pickLogoSource(overrides, null, null)).toBeNull();
});

test('a hosted url is used when nothing is bundled for the code', () => {
  expect(pickLogoSource(overrides, 'ubl', 'https://cdn.example/ubl.png'))
    .toEqual({ kind: 'remote', uri: 'https://cdn.example/ubl.png' });
  expect(pickLogoSource(overrides, undefined, 'https://cdn.example/x.png'))
    .toEqual({ kind: 'remote', uri: 'https://cdn.example/x.png' });
});

test('a bundled override wins over the hosted url', () => {
  expect(pickLogoSource(overrides, 'hbl', 'https://cdn.example/hbl.png'))
    .toEqual({ kind: 'local', module: 101 });
});

test('override lookup is case- and whitespace-insensitive', () => {
  expect(pickLogoSource(overrides, 'HBL', undefined)).toEqual({ kind: 'local', module: 101 });
  expect(pickLogoSource(overrides, '  EasyPaisa  ', undefined)).toEqual({ kind: 'local', module: 102 });
});

test('asset handle 0 is a real override, not a miss', () => {
  // Metro asset ids are numbers and the first one registered is 0 — a
  // truthiness check here would silently fall through to the url.
  expect(pickLogoSource(overrides, 'zero', 'https://cdn.example/z.png'))
    .toEqual({ kind: 'local', module: 0 });
});

test('inherited Object properties are not mistaken for overrides', () => {
  expect(pickLogoSource(overrides, 'toString', undefined)).toBeNull();
  expect(pickLogoSource(overrides, 'constructor', 'https://cdn.example/c.png'))
    .toEqual({ kind: 'remote', uri: 'https://cdn.example/c.png' });
});

test('a blank or whitespace url is not a url', () => {
  expect(pickLogoSource(overrides, 'ubl', '')).toBeNull();
  expect(pickLogoSource(overrides, 'ubl', '   ')).toBeNull();
});

test('a url is trimmed before use', () => {
  expect(pickLogoSource(overrides, undefined, '  https://cdn.example/a.png '))
    .toEqual({ kind: 'remote', uri: 'https://cdn.example/a.png' });
});

test('the shipped override map starts empty', () => {
  // Guards the convention in assets/logos/README.md: an override is added
  // deliberately, alongside the PNG it points at.
  expect(Object.keys(LOGO_OVERRIDES)).toEqual([]);
});

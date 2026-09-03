import { light, dark } from '../tokens';

// docs/2026-09-02-payo-revamp-design.md §2 — verbatim value list.
const SPEC_LIGHT: Record<string, string> = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  surface2: '#F1EDE4',
  separator: '#E7E1D6',
  ink: '#0E2233',
  ink2: '#5B6B78',
  ink3: '#8A98A4',
  amber: '#F2A93B',
  amberDeep: '#D98F1F',
  amberTint: '#FBEBD0',
  green: '#1F9D6A',
  greenTint: '#DDF3E9',
  red: '#D64545',
  redTint: '#FBE3E3',
  navy: '#0D2A3D',
  onAmber: '#0D2A3D',
  avatarBlueTint: '#E3EEF7',
  avatarBlue: '#2E5B7A',
  avatarVioletTint: '#EEE6F7',
  avatarViolet: '#6B4E9B',
  white: '#FFFFFF',
};

const SPEC_DARK: Record<string, string> = {
  bg: '#0B141C',
  surface: '#14202A',
  surface2: '#1C2A35',
  separator: '#243441',
  ink: '#F3F6F8',
  ink2: '#A7B4BF',
  ink3: '#6F7E8A',
  amber: '#F5B34D',
  amberDeep: '#E19A2A',
  amberTint: '#3A2E19',
  green: '#3FC48A',
  greenTint: '#153826',
  red: '#F06A6A',
  redTint: '#3A1C1C',
  navy: '#0D2A3D',
  onAmber: '#F3F6F8',
  avatarBlueTint: '#1C2A35',
  avatarBlue: '#8FB8D6',
  avatarVioletTint: '#2A2236',
  avatarViolet: '#B9A3DA',
  white: '#FFFFFF',
};

test('light and dark palettes have identical key sets', () => {
  expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
});

test('light palette matches the spec exactly', () => {
  expect(light).toEqual(SPEC_LIGHT);
});

test('dark palette matches the spec exactly', () => {
  expect(dark).toEqual(SPEC_DARK);
});

test('every palette value is a hex color from the spec list', () => {
  const allowed = new Set([...Object.values(SPEC_LIGHT), ...Object.values(SPEC_DARK)]);
  for (const value of [...Object.values(light), ...Object.values(dark)]) {
    expect(allowed.has(value)).toBe(true);
  }
});

import { glass, light, dark, radius, glassTokens, shadow } from '../tokens';

// docs/design/v8-pen/GLASS-SPEC.md §1 — verbatim value list.
const SPEC_GLASS: Record<string, string> = {
  navy: '#0D2A3D',
  navyDeep: '#071A28',
  bg: '#0D2A3D',
  surface: 'rgba(255,255,255,0.08)',
  surface2: 'rgba(255,255,255,0.14)',
  separator: 'rgba(255,255,255,0.15)',
  ink: '#F7F4EE',
  ink2: '#C9D8E6',
  ink3: '#8FB8D6',
  amber: '#F2A93B',
  amberDeep: '#F2A93B',
  amberTint: 'rgba(242,169,59,0.18)',
  cream: '#FBEBD0',
  green: '#3FC48A',
  greenTint: 'rgba(63,196,138,0.18)',
  red: '#F06A6A',
  redTint: 'rgba(240,106,106,0.18)',
  onAmber: '#0D2A3D',
  avatarBlueTint: '#1E4A66',
  avatarBlue: '#F7F4EE',
  avatarVioletTint: '#2A2236',
  avatarViolet: '#B9A3DA',
  white: '#FFFFFF',
};

test('the glass palette matches GLASS-SPEC §1 exactly', () => {
  expect(glass).toEqual(SPEC_GLASS);
});

test('light and dark are aliases of the one glass palette (no light mode)', () => {
  expect(light).toBe(glass);
  expect(dark).toBe(glass);
});

test('every palette value is a hex or rgba colour literal', () => {
  const re = /^(#[0-9A-F]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},0?\.\d+\))$/;
  for (const value of Object.values(glass)) expect(value).toMatch(re);
});

test('background is navy and the gradient bottom is navyDeep', () => {
  expect(glass.bg).toBe(glass.navy);
  expect(glass.navyDeep).not.toBe(glass.navy);
});

test('radii follow §2: card 24, tile 20, input 16, button 28', () => {
  expect(radius.card).toBe(24);
  expect(radius.tile).toBe(20);
  expect(radius.input).toBe(16);
  expect(radius.button).toBe(28);
});

test('nav + orb geometry follows §3/§4', () => {
  expect(glassTokens.nav.height).toBe(72);
  expect(glassTokens.nav.radius).toBe(36);
  expect(glassTokens.nav.fill).toBe('rgba(16,40,58,0.92)');
  expect(glassTokens.orb).toMatchObject({ hero: 120, nav: 60, mini: 56, navRaise: 10 });
  expect(glassTokens.orb.glow.shadowColor).toBe(glass.amber);
  expect(glassTokens.dueBill).toEqual({ fill: 'rgba(242,169,59,0.10)', line: 'rgba(242,169,59,0.35)' });
});

test('the dark card shadow is the no-shadow variant (§6 rule 2)', () => {
  expect(shadow.card.dark.shadowOpacity).toBe(0);
  expect(shadow.card.dark.elevation).toBe(0);
});

// PAYO revamp design tokens — verbatim from docs/2026-09-02-payo-revamp-design.md §2
// and docs/design/revamp-v1/Foundations.dc.html. Do not invent new values here;
// every color/size must trace back to those two sources.

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  separator: string;
  ink: string;
  ink2: string;
  ink3: string;
  amber: string;
  amberDeep: string;
  amberTint: string;
  green: string;
  greenTint: string;
  red: string;
  redTint: string;
  navy: string;
}

export const light: Palette = {
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
};

export const dark: Palette = {
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
  // Dark keeps the same navy — Wallet.dc.html / Main.dc.html AI bar & bubbles
  // stay navy in both themes (it is already dark).
  navy: '#0D2A3D',
};

// Type scale — Foundations.dc.html .money/.h1/.h2/.hl/.body/.sub/.foot/.cap
export const type = {
  money: { fontSize: 40, lineHeight: 48, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  hl: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  sub: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  foot: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  cap: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4 },
  urduLineHeightMult: 1.9,
  fontFamily: {
    400: 'PlusJakartaSans_400Regular',
    500: 'PlusJakartaSans_500Medium',
    600: 'PlusJakartaSans_600SemiBold',
    700: 'PlusJakartaSans_700Bold',
    800: 'PlusJakartaSans_800ExtraBold',
  },
  urduFontFamily: 'NotoNastaliqUrdu',
  maxFontSizeMultiplier: 1.6,
} as const;

// Radii — Foundations.dc.html "Radii: card 20 · button 28 (pill) · input 16 · tile 18 · avatar circle"
export const radius = {
  card: 20,
  button: 28,
  input: 16,
  tile: 18,
  avatar: 999,
  pill: 999,
} as const;

// Spacing — Foundations.dc.html "Spacing: 4/8/12/16/20/24/32 · screen gutter 20"
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 20,
} as const;

// Touch targets — "Touch targets ≥ 44pt, primary CTAs 56pt"
export const touch = {
  min: 44,
  primary: 56,
  key: 64,
  keyLarge: 72,
} as const;

// Card shadow — "0 8 24 rgba(14,34,51,.06) on cards; none in dark"
export const shadow = {
  card: {
    light: {
      shadowColor: 'rgba(14,34,51,1)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 3,
    },
    dark: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
} as const;

// Legacy token shape kept so existing (pre-revamp) screens keep compiling and
// keep rendering EXACTLY as before, until each is migrated onto light/dark/
// type/radius/space/touch/shadow in its own phase. These are frozen to the
// ORIGINAL literal values from git HEAD (pre-R3) — do NOT derive them from
// the new palette/scale above, and do NOT edit them to match the new design;
// un-migrated screens must not silently change. New code must import
// light/dark/type/radius/space/touch/shadow via useTheme() instead of this.
export const tokens = {
  color: {
    bg: '#0B0F14',           // deep ink
    surface: '#151B23',
    surfaceRaised: '#1D2530',
    accent: '#3DF2B6',       // electric mint
    accentPressed: '#2BD9A0',
    text: '#F2F6FA',
    textMuted: '#93A1B0',
    danger: '#FF5D6C',
    success: '#3DF2B6',
    // light mode
    lightBg: '#F6F8FA', lightSurface: '#FFFFFF', lightText: '#0B0F14',
  },
  radius: { card: 20, button: 16, pill: 999 },
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48 },
  type: {
    money: 44, h1: 28, h2: 22, body: 18, caption: 15, // elder-friendly floor: body ≥ 18
    urduFont: 'NotoNastaliqUrdu', urduLineHeightMult: 1.9, // Nastaliq needs tall lines
  },
  touch: { primary: 56 }, // min touch target for primary actions
} as const;

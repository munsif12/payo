// PAYO Direction B ("glass / voice orb") design tokens — verbatim from
// docs/design/v8-pen/GLASS-SPEC.md (§1 palette, §2 glass objects, §3 orb,
// §4 nav). Do not invent new values here; every colour/size must trace back to
// that file. The app is one dark navy theme: `light` and `dark` are aliases of
// `glass` so every existing import (`dark as onNavy`, …) resolves to the same inks.

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
  /** Gradient bottom, PIN sheet body. */
  navyDeep: string;
  /** People-you-pay avatars (navy initials). */
  cream: string;
  onAmber: string;
  avatarBlueTint: string;
  avatarBlue: string;
  avatarVioletTint: string;
  avatarViolet: string;
  white: string;
}

// GLASS-SPEC.md §1 — the one palette.
export const glass: Palette = {
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

/** Aliases — the design has no light mode (spec §1). Kept so screens that
 *  import `dark as onNavy` (text on navy) keep compiling and resolve to glass. */
export const light: Palette = glass;
export const dark: Palette = glass;

// Geometry and tints the glass objects share (spec §2–§4). Numbers used by
// exactly one screen stay at that screen's use site.
export const glassTokens = {
  /** Every glass object carries a 1 px `separator` line (§6 rule 2). */
  line: 1,
  /** Input focus ring (§2). */
  inputFocusLine: 1.5,
  /** §4 — the floating nav pill. `fill` is glass over the gradient that must
   *  stay legible, so it is navy-tinted rather than plain white glass. */
  nav: {
    height: 72,
    radius: 36,
    marginH: 16,
    marginBottom: 8,
    fill: 'rgba(16,40,58,0.92)',
    activeHalo: 56,
    icon: 24,
    label: 11,
  },
  /** §3 — the orb in its three sizes, and its glow. */
  orb: {
    hero: 120,
    nav: 60,
    mini: 56,
    /** The nav orb sits this much above the pill's top edge. */
    navRaise: 10,
    glow: {
      shadowColor: '#F2A93B',
      shadowOpacity: 0.55,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 0 },
    },
    /** Android has no coloured shadow: a translucent amber disc behind the orb,
     *  150 pt for the 120 pt hero (×1.25). */
    androidHalo: 'rgba(242,169,59,0.25)',
    androidHaloScale: 1.25,
  },
  /** §2 — the due-bill card's amber tint. */
  dueBill: {
    fill: 'rgba(242,169,59,0.10)',
    line: 'rgba(242,169,59,0.35)',
  },
  /** §5 PIN sheet — "Backdrop black 0.5". */
  backdrop: { color: '#000000', opacity: 0.5 },
} as const;

// Type scale — unchanged from Foundations .money/.h1/.h2/.hl/.body/.sub/.foot/.cap
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

// Radii — GLASS-SPEC §2: card 24 · tile 20 · button 28 (pill) · input 16 · avatar circle
export const radius = {
  card: 24,
  button: 28,
  input: 16,
  tile: 20,
  avatar: 999,
  pill: 999,
} as const;

// Spacing — "4/8/12/16/20/24/32 · screen gutter 20"
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

// Touch targets — "Touch targets ≥ 44pt, primary CTAs 56pt"; keys 64 (72 on PIN)
export const touch = {
  min: 44,
  primary: 56,
  key: 64,
  keyLarge: 72,
} as const;

// Shadows — GLASS-SPEC §6 rule 2: no drop shadows except the orb glow.
// `useTheme().dark` is always true, so every `dark ? shadow.card.dark :
// shadow.card.light` resolves to the no-shadow variant; `light` stays for API
// compatibility only.
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

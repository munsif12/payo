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

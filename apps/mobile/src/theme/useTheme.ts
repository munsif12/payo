import { glass, type Palette } from './tokens';

export interface Theme {
  c: Palette;
  dark: boolean;
}

// Direction B is dark-only (GLASS-SPEC §1): the system scheme is ignored and
// every screen gets the glass palette. `dark` stays true so the existing
// `dark ? shadow.card.dark : shadow.card.light` branches pick no shadow.
const THEME: Theme = { c: glass, dark: true };

export function useTheme(): Theme {
  return THEME;
}

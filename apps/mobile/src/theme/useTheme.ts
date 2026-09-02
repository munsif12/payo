import { useColorScheme } from 'react-native';
import { light, dark, type Palette } from './tokens';

export interface Theme {
  c: Palette;
  dark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { c: isDark ? dark : light, dark: isDark };
}

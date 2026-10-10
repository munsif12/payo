import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space, glassTokens } from '../theme/tokens';

// Card — GLASS-SPEC §2: glass fill (`surface`), the 1 px `separator` line,
// radius 24, padding 20. No shadow (§6 rule 2). Smaller tiles pass
// `style={{ borderRadius: radius.tile }}`.
export function Card({ children, style, padding = space.xl }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          borderRadius: radius.card,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

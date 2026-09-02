import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space, shadow } from '../theme/tokens';

// Card — Foundations.dc.html .card: surface bg, 20 radius, soft shadow in
// light, no shadow in dark (use surface steps instead).
export function Card({ children, style, padding = space.xl }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  const { c, dark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.card,
          padding,
        },
        dark ? shadow.card.dark : shadow.card.light,
        style,
      ]}
    >
      {children}
    </View>
  );
}

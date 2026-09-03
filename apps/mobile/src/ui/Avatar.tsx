import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar — Foundations.dc.html .avatar: 44pt circle, initials 15/700.
export function Avatar({ name, size = 44, bg, color, style }: {
  name: string;
  size?: number;
  bg?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg ?? c.amberTint,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        style,
      ]}
    >
      <Text variant="sub" weight={700} color={color ?? c.onAmber} style={{ lineHeight: undefined, fontSize: 15 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

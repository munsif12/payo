import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';

// Pill — Foundations.dc.html .pill: 28pt tall, 14 radius, 12/700 text, 6px
// icon gap. Used for status pills (green/greenTint) and the header balance
// pill (custom height via `height`).
export function Pill({ label, bg, color, icon, height = 28, style }: {
  label: string;
  bg: string;
  color: string;
  icon?: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height,
          paddingHorizontal: 10,
          borderRadius: height / 2,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon}
      <Text variant="cap" weight={700} color={color} style={{ textTransform: 'none', letterSpacing: undefined, lineHeight: undefined, fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

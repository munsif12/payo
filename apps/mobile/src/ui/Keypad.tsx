import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Delete } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { radius, shadow } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Key({ children, onPress, size, testID }: {
  children: React.ReactNode;
  onPress?: () => void;
  size: number;
  testID?: string;
}) {
  const { c, dark } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  if (!onPress) {
    return <View style={{ height: size, flex: 1 }}>{children}</View>;
  }
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height: size,
          flex: 1,
          borderRadius: radius.tile + 2,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dark ? shadow.card.dark : shadow.card.light,
        pressStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  size?: 64 | 72;
  /** Rendered in the bottom-left slot instead of a blank key (e.g. "Resend 0:42"). */
  leftSlot?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Keypad — Foundations.dc.html .kpad/.key: 3-col grid, 12px gap, 64pt keys
// (72pt on PIN screens per Pin.dc.html), left slot in the bottom row, a
// backspace icon key. Each press fires Haptics.selectionAsync.
export function Keypad({ onDigit, onBackspace, size = 64, leftSlot, disabled, style }: KeypadProps) {
  const { c } = useTheme();
  const rows = [DIGITS.slice(0, 3), DIGITS.slice(3, 6), DIGITS.slice(6, 9)];

  return (
    <View style={[{ gap: 12 }, style]}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((d) => (
            <Key key={d} size={size} onPress={disabled ? undefined : () => onDigit(d)} testID={`keypad-${d}`}>
              <Text variant="h2" weight={600}>{d}</Text>
            </Key>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Key size={size}>{leftSlot}</Key>
        <Key size={size} onPress={disabled ? undefined : () => onDigit('0')} testID="keypad-0">
          <Text variant="h2" weight={600}>0</Text>
        </Key>
        <Key size={size} onPress={disabled ? undefined : onBackspace} testID="keypad-backspace">
          <Delete size={26} color={c.ink2} strokeWidth={2} />
        </Key>
      </View>
    </View>
  );
}

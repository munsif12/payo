import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Delete } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { radius, glassTokens } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** GLASS-SPEC §2: digit 26/600 cream. */
const DIGIT_SIZE = 26;
const DIGIT_LINE_HEIGHT = 32;

function Key({ children, onPress, size, testID, accessibilityLabel }: {
  children: React.ReactNode;
  onPress?: () => void;
  size: number;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  if (!onPress) {
    return <View style={{ height: size, flex: 1 }}>{children}</View>;
  }
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
          borderRadius: radius.tile,
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

function Digit({ children }: { children: string }) {
  const { c } = useTheme();
  return (
    <Text variant="h2" weight={600} color={c.ink} style={{ fontSize: DIGIT_SIZE, lineHeight: DIGIT_LINE_HEIGHT, letterSpacing: undefined }}>
      {children}
    </Text>
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

// Keypad — GLASS-SPEC §2: 3-col grid, 12 px gap, glass keys (fill + line,
// radius 20), 64 pt (72 on PIN), digit 26/600 cream, left slot in the bottom
// row, a backspace icon key. Each press fires Haptics.selectionAsync.
export function Keypad({ onDigit, onBackspace, size = 64, leftSlot, disabled, style }: KeypadProps) {
  const { c } = useTheme();
  const rows = [DIGITS.slice(0, 3), DIGITS.slice(3, 6), DIGITS.slice(6, 9)];

  return (
    <View style={[{ gap: 12 }, style]}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((d) => (
            <Key key={d} size={size} onPress={disabled ? undefined : () => onDigit(d)} testID={`keypad-${d}`} accessibilityLabel={d}>
              <Digit>{d}</Digit>
            </Key>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Key size={size}>{leftSlot}</Key>
        <Key size={size} onPress={disabled ? undefined : () => onDigit('0')} testID="keypad-0" accessibilityLabel="0">
          <Digit>0</Digit>
        </Key>
        <Key size={size} onPress={disabled ? undefined : onBackspace} testID="keypad-backspace" accessibilityLabel="Backspace">
          <Delete size={26} color={c.ink} strokeWidth={2} />
        </Key>
      </View>
    </View>
  );
}

import React from 'react';
import { Pressable, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { radius, touch } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Button — Foundations.dc.html .btn (primary, amber pill 56pt) / .btn2
// (secondary, surface2 pill 56pt) / .btnGhost (ghost, 52pt no fill); danger
// mirrors the redTint/red status-pill pairing used elsewhere in the system.
// Press feedback: scale 0.98 over 100ms + Haptics.selectionAsync, per
// Motion.dc.html "Touch feedback".
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style, testID }: ButtonProps) {
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  const height = variant === 'ghost' ? 52 : touch.primary;
  const bg =
    variant === 'primary' ? c.amber :
    variant === 'secondary' ? c.surface2 :
    variant === 'danger' ? c.redTint :
    'transparent';
  const textColor =
    variant === 'primary' ? c.navy :
    variant === 'secondary' ? c.ink :
    variant === 'danger' ? c.red :
    c.ink2;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height,
          minHeight: touch.min,
          borderRadius: radius.button,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 20,
        },
        pressStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text variant="hl" color={textColor} weight={variant === 'primary' ? 700 : 600}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

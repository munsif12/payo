import React from 'react';
import { Pressable, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { radius, touch, glassTokens } from '../theme/tokens';
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

// Button — GLASS-SPEC §2: primary = amber pill, 56 pt, navy 700 text
// (unchanged); secondary = glass fill + line, cream text; ghost = no fill,
// ink2 (52 pt); danger = redTint fill, red text.
// Press feedback: scale over D_MICRO + Haptics.selectionAsync (unchanged).
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style, testID }: ButtonProps) {
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  const height = variant === 'ghost' ? 52 : touch.primary;
  const bg =
    variant === 'primary' ? c.amber :
    variant === 'secondary' ? c.surface :
    variant === 'danger' ? c.redTint :
    'transparent';
  const textColor =
    variant === 'primary' ? c.onAmber :
    variant === 'secondary' ? c.ink :
    variant === 'danger' ? c.red :
    c.ink2;
  // Only the glass variant carries the line (§6 rule 2); amber and tints are flat.
  const borderWidth = variant === 'secondary' ? glassTokens.line : 0;

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
          borderWidth,
          borderColor: c.separator,
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
          {/* A button is a fixed-height pill, so a label that wraps is a label that
              gets clipped — and a two-word one ("Approve") was breaking mid-word.
              Keep it to one line and let it shrink (to 0.8x) instead. */}
          <Text
            variant="hl"
            color={textColor}
            weight={variant === 'primary' ? 700 : 600}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { glassTokens } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Chip — GLASS-SPEC §2: a 36 pt glass pill with the 1 px line; selected =
// amber fill, navy text (e.g. the Activity filters).
export function Chip({ label, selected, onPress, style, testID }: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 18,
          backgroundColor: selected ? c.amber : c.surface,
          borderWidth: glassTokens.line,
          borderColor: selected ? c.amber : c.separator,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          alignSelf: 'flex-start',
        },
        pressStyle,
        style,
      ]}
    >
      <Text variant="sub" weight={600} color={selected ? c.onAmber : c.ink} style={{ lineHeight: undefined, fontSize: 14 }}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Chip — Foundations.dc.html .chip / .chipOn: 36pt tall, 18 radius pill,
// surface2 bg by default, navy bg + white text when selected (e.g. Activity
// filters).
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
          backgroundColor: selected ? c.navy : c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          alignSelf: 'flex-start',
        },
        pressStyle,
        style,
      ]}
    >
      <Text variant="sub" weight={600} color={selected ? '#FFFFFF' : c.ink2} style={{ lineHeight: undefined, fontSize: 14 }}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

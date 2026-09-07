import React, { useEffect } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { D_UI, D_MICRO, EASE_OUT, EASE_IN, ICON_SWAP } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);
const easeIn = Easing.bezier(EASE_IN[0], EASE_IN[1], EASE_IN[2], EASE_IN[3]);

export interface IconSwapProps {
  /** False shows `from`, true shows `to`. */
  active: boolean;
  from: React.ReactNode;
  to: React.ReactNode;
  /** Square box both icons are centred in. */
  size: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// IconSwap — spec §3 ICON_SWAP: an icon changing state cross-fades. The arriving
// icon scales 0.25 → 1 with opacity 0 → 1 on EASE_OUT (it is an entrance); the
// leaving one runs the mirror on EASE_IN (it is an exit); both over D_UI.
// Transform + opacity only. Reduced motion: a D_MICRO opacity cross-fade, no scale.
export function IconSwap({ active, from, to, size, style, testID }: IconSwapProps) {
  const reducedMotion = useReducedMotion();
  // Two values, not one: whichever icon is ARRIVING eases out (entrances) and
  // whichever is LEAVING eases in (exits), in both directions of the swap.
  const fromShown = useSharedValue(active ? 0 : 1);
  const toShown = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      fromShown.value = withTiming(active ? 0 : 1, { duration: D_MICRO });
      toShown.value = withTiming(active ? 1 : 0, { duration: D_MICRO });
      return;
    }
    fromShown.value = withTiming(active ? 0 : 1, { duration: D_UI, easing: active ? easeIn : easeOut });
    toShown.value = withTiming(active ? 1 : 0, { duration: D_UI, easing: active ? easeOut : easeIn });
  }, [active, reducedMotion, fromShown, toShown]);

  const fromStyle = useAnimatedStyle(() => ({
    opacity: fromShown.value,
    transform: [
      { scale: reducedMotion ? 1 : ICON_SWAP.scaleFrom + fromShown.value * (1 - ICON_SWAP.scaleFrom) },
    ],
  }));

  const toStyle = useAnimatedStyle(() => ({
    opacity: toShown.value,
    transform: [
      { scale: reducedMotion ? 1 : ICON_SWAP.scaleFrom + toShown.value * (1 - ICON_SWAP.scaleFrom) },
    ],
  }));

  return (
    <View testID={testID} pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, fromStyle]}>{from}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, toStyle]}>{to}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});

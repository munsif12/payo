import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { BREATHE_MS, BREATHE_SCALE, EASE_INOUT_SPEC } from './config';

const easeInOut = Easing.bezier(
  EASE_INOUT_SPEC[0], EASE_INOUT_SPEC[1], EASE_INOUT_SPEC[2], EASE_INOUT_SPEC[3],
);

// Home mic idle loop — scale 1 -> 1.04 -> 1, 2.4s, ease-in-out, infinite.
// Motion.dc.html "Mic idle" row. Stops (and must be unmounted/disabled) once
// listening starts. Reduced motion: static, no loop.
export function Breathe({ active = true, children, style }: {
  active?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion || !active) {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 150 });
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(BREATHE_SCALE, { duration: BREATHE_MS / 2, easing: easeInOut }),
        withTiming(1, { duration: BREATHE_MS / 2, easing: easeInOut }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(scale);
  }, [active, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

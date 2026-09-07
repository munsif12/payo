import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { D_MICRO, EASE_OUT } from '../motion/config';

// PIN-screen-local numbers (spec §3 owns only the shared tokens).
const PIN_DOT_MS = D_MICRO;
const PIN_DOT_SCALE = 1.1;
const SHAKE_PX = 4;
const SHAKE_MS = 200;
import { useReducedMotion } from '../motion/useReducedMotion';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);
const linear = Easing.linear;

function Dot({ filled, size, reducedMotion }: { filled: boolean; size: number; reducedMotion: boolean }) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const wasFilled = useRef(filled);

  useEffect(() => {
    if (filled && !wasFilled.current && !reducedMotion) {
      scale.value = withSequence(
        withTiming(PIN_DOT_SCALE, { duration: PIN_DOT_MS * 0.6, easing: easeOut }),
        withTiming(1, { duration: PIN_DOT_MS * 0.4, easing: easeOut }),
      );
    }
    wasFilled.current = filled;
  }, [filled, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: filled ? c.amber : c.ink3,
          backgroundColor: filled ? c.amber : 'transparent',
        },
        style,
      ]}
    />
  );
}

export interface PinDotsHandle {
  shake: () => void;
}

export interface PinDotsProps {
  length?: number;
  filled: number;
  size?: number;
  gap?: number;
  /** Layout only — the PIN sheet spaces the row per HomePinSheet.dc.html. */
  style?: StyleProp<ViewStyle>;
}

// PinDots — Foundations.dc.html .dot/.dotOn: 16pt dots (18pt on the PIN
// screens), border ink3, amber fill on entry with a 150ms scale-up settle.
// Wrong PIN: call ref.shake() for a 4px/200ms shake, then clear the pin.
export const PinDots = forwardRef<PinDotsHandle, PinDotsProps>(function PinDots(
  { length = 4, filled, size = 18, gap = 20, style },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    shake: () => {
      if (reducedMotion) return;
      const leg = SHAKE_MS / 4;
      offset.value = withSequence(
        withTiming(-SHAKE_PX, { duration: leg, easing: linear }),
        withTiming(SHAKE_PX, { duration: leg * 2, easing: linear }),
        withTiming(0, { duration: leg, easing: linear }),
      );
    },
  }), [reducedMotion, offset]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${filled} of ${length} digits entered`}
      style={[{ flexDirection: 'row', gap }, style, containerStyle]}
    >
      {Array.from({ length }).map((_, i) => (
        <Dot key={i} filled={i < filled} size={size} reducedMotion={reducedMotion} />
      ))}
    </Animated.View>
  );
});

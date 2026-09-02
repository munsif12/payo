import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PIN_DOT_MS, PIN_DOT_SCALE, SHAKE_PX, SHAKE_MS } from '../motion/config';
import { useReducedMotion } from '../motion/useReducedMotion';

const easeOut = Easing.out(Easing.ease);
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
}

// PinDots — Foundations.dc.html .dot/.dotOn: 16pt dots (18pt on the PIN
// screens), border ink3, amber fill on entry with a 150ms scale-up settle.
// Wrong PIN: call ref.shake() for a 4px/200ms shake, then clear the pin.
export const PinDots = forwardRef<PinDotsHandle, PinDotsProps>(function PinDots(
  { length = 4, filled, size = 18, gap = 20 },
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
    <Animated.View style={[{ flexDirection: 'row', gap }, containerStyle]}>
      {Array.from({ length }).map((_, i) => (
        <Dot key={i} filled={i < filled} size={size} reducedMotion={reducedMotion} />
      ))}
    </Animated.View>
  );
});

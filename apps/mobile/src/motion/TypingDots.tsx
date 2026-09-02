import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { DOTS_MS, DOTS_OFFSET_MS, DOTS_LIFT_PX } from './config';

const easeInOut = Easing.inOut(Easing.ease);

function Dot({ color, delayMs, reducedMotion }: { color: string; delayMs: number; reducedMotion: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Mirrors the artboard keyframes: 0%,80%,100% -> opacity .25/y0,
    // 40% -> opacity 1 / y -3px.
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOTS_MS * 0.4, easing: easeInOut }),
          withTiming(0, { duration: DOTS_MS * 0.6, easing: easeInOut }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [reducedMotion, delayMs, progress]);

  const style = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 1, transform: [{ translateY: 0 }] };
    return {
      opacity: 0.25 + progress.value * 0.75,
      transform: [{ translateY: -progress.value * DOTS_LIFT_PX }],
    };
  });

  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

// Assistant "thinking" indicator — 3 dots, 150ms apart, 3px lift, 1.2s loop.
// Motion.dc.html "Thinking" row. Reduced motion: static (fully opaque) dots.
export function TypingDots({ color = '#8A98A4', gap = 4 }: { color?: string; gap?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <Dot color={color} delayMs={0} reducedMotion={reducedMotion} />
      <Dot color={color} delayMs={DOTS_OFFSET_MS} reducedMotion={reducedMotion} />
      <Dot color={color} delayMs={DOTS_OFFSET_MS * 2} reducedMotion={reducedMotion} />
    </View>
  );
}

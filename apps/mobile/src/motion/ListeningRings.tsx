import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withDelay,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { RING_MS, RING_SCALE_TO, RING_OPACITY_FROM, RING_OFFSET_MS, EASE_OUT } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

function Ring({ size, color, delayMs, reducedMotion }: {
  size: number; color: string; delayMs: number; reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: RING_MS, easing: easeOut }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [reducedMotion, delayMs, progress]);

  const style = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 0 };
    const scale = 1 + progress.value * (RING_SCALE_TO - 1);
    const opacity = RING_OPACITY_FROM * (1 - progress.value);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }} />
    </Animated.View>
  );
}

// Two expanding, fading rings around the mic while listening. Motion.dc.html
// "Listening" row: 1.8s ring loop, ease-out, scale 1->2.1, opacity .5->0,
// second ring offset 600ms. Reduced motion: rings hidden entirely (no loop).
export function ListeningRings({ size = 64, color = '#F2A93B' }: { size?: number; color?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Ring size={size} color={color} delayMs={0} reducedMotion={reducedMotion} />
      <Ring size={size} color={color} delayMs={RING_OFFSET_MS} reducedMotion={reducedMotion} />
    </View>
  );
}

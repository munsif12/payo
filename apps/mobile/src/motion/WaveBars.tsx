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
// Screen-local numbers: the v7 motion table (config.ts) owns only shared tokens.
const WAVE_BARS_MS = 900;
const WAVE_BAR_COUNT = 10;
const WAVE_BAR_SCALE_MIN = 0.35;

const easeInOut = Easing.inOut(Easing.ease);

function Bar({ color, delayMs, reducedMotion }: { color: string; delayMs: number; reducedMotion: boolean }) {
  const scale = useSharedValue(reducedMotion ? 1 : WAVE_BAR_SCALE_MIN);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: WAVE_BARS_MS / 2, easing: easeInOut }),
          withTiming(WAVE_BAR_SCALE_MIN, { duration: WAVE_BARS_MS / 2, easing: easeInOut }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(scale);
  }, [reducedMotion, delayMs, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <Animated.View
      style={[{ width: 4, height: 24, borderRadius: 2, backgroundColor: color }, style]}
    />
  );
}

// Listening waveform — 10 bars, scaleY 0.35<->1, 900ms ease-in-out loop, each
// bar phase-shifted for a waveform look. Motion.dc.html "Listening" row.
export function WaveBars({ color = '#0D2A3D', gap = 4 }: { color?: string; gap?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => (
        <Bar key={i} color={color} delayMs={(i * WAVE_BARS_MS) / WAVE_BAR_COUNT} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

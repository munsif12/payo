import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { BAR_WIDTH, BAR_GAP, BAR_MAX_HEIGHT, BAR_WEIGHTS, MIN_SCALE } from './waveformLevel';

/** Bars at rest while reduced motion is on — a static, readable silhouette. */
const STATIC_SCALE = 0.6;

// The metering maths is pure (and unit-tested) — see ./waveformLevel.
export {
  BAR_COUNT, BAR_MAX_HEIGHT, METERING_FLOOR_DB, levelFromDb, smoothLevel,
} from './waveformLevel';

function Bar({ weight, color, level, reducedMotion }: {
  weight: number;
  color: string;
  level: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const height = BAR_MAX_HEIGHT * weight;

  // Read straight off the shared value: the bars follow the mic entirely on the
  // UI thread, with no React render per metering sample. A scaleY scales about
  // the bar's CENTRE, so the translateY puts the bottom edge back where it was —
  // the waveform grows upward off the baseline, as the artboard draws it.
  const style = useAnimatedStyle(() => {
    const scale = reducedMotion ? STATIC_SCALE : MIN_SCALE + (1 - MIN_SCALE) * level.value;
    return {
      transform: [
        { translateY: (height * (1 - scale)) / 2 },
        { scaleY: scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          height,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export interface WaveformProps {
  /** 0…1, written by useRecorder on the UI thread (already smoothed). */
  level: SharedValue<number>;
  color: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Waveform — the real "I am listening" cue (spec §3): 12 bars whose amplitude
// follows useRecorder's metering, so the mic needs no label. scaleY only, on the
// UI thread — no height animation. Reduced motion: static bars, no loop, no
// reaction to level.
export function Waveform({ level, color, style, testID }: WaveformProps) {
  const reducedMotion = useReducedMotion();
  return (
    <View
      testID={testID}
      style={[
        { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, height: BAR_MAX_HEIGHT },
        style,
      ]}
    >
      {BAR_WEIGHTS.map((weight, i) => (
        <Bar key={i} weight={weight} color={color} level={level} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

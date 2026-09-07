import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { D_ENTER, D_MICRO, EASE_OUT } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** Entrance travel. Spec §3: exits translate ≤ 12 pt, entrances rise from here. */
export const RISE_TRANSLATE_Y = 12;

// Row / card entrance: opacity 0->1, translateY 12->0, D_ENTER ease-out,
// optionally delayed for the STAGGER cascade (first paint only — the caller
// owns that decision via useFirstPaint). Reduced motion: D_MICRO opacity, no
// translate.
export function useRise(delayMs = 0) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Latched at mount. The caller computes the stagger from useFirstPaint, which
  // flips to false right after the first commit — without this latch that flip
  // would change `delayMs` and replay the entrance of every mounted row.
  const delay = useRef(delayMs).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.value = withTiming(1, { duration: D_MICRO });
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration: D_ENTER, easing: easeOut }));
  }, [delay, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - progress.value) * RISE_TRANSLATE_Y },
    ],
  }));

  return style;
}

export function Rise({ delay = 0, children, style }: {
  delay?: number;
  children: React.ReactNode;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}) {
  const animatedStyle = useRise(delay);
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

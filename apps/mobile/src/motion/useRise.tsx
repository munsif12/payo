import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { RISE_MS, RISE_TRANSLATE_Y, EASE_OUT } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

// Home greeting / suggestion-card rise: opacity 0->1, translateY 12->0,
// 300ms ease-out, optionally delayed for the 60ms stagger. Motion.dc.html
// "Home greeting" + "Suggestion cards" rows.
export function useRise(delayMs = 0) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delayMs, withTiming(1, { duration: RISE_MS, easing: easeOut }));
  }, [delayMs, reducedMotion, progress]);

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

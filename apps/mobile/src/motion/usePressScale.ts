import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { PRESS_SCALE, D_MICRO, EASE_OUT, EASE_IN } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);
const easeIn = Easing.bezier(EASE_IN[0], EASE_IN[1], EASE_IN[2], EASE_IN[3]);

// Touch feedback used by Button/Card/Chip/ListRow/the mic FAB etc: scale to
// PRESS_SCALE over D_MICRO on press, restoring on release (spec §3 "PRESS_SCALE").
// Transform-only, so it runs on the UI thread. Reduced motion disables it.
export function usePressScale() {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (reducedMotion) return;
    scale.value = withTiming(PRESS_SCALE, { duration: D_MICRO, easing: easeIn });
  };
  const onPressOut = () => {
    if (reducedMotion) return;
    scale.value = withTiming(1, { duration: D_MICRO, easing: easeOut });
  };

  return { style, onPressIn, onPressOut };
}

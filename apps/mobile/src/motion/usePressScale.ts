import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { PRESS_SCALE, PRESS_MS } from './config';

const easeOut = Easing.out(Easing.ease);

// Touch feedback used by Button/Card/Chip/ListRow etc: scale 0.98 over
// 100ms ease-out on press, restoring on release. Motion.dc.html "Touch
// feedback" row. Reduced motion disables the scale (opacity-only philosophy
// — there's no opacity change here, so it's simply a no-op).
export function usePressScale() {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (reducedMotion) return;
    scale.value = withTiming(PRESS_SCALE, { duration: PRESS_MS, easing: easeOut });
  };
  const onPressOut = () => {
    if (reducedMotion) return;
    scale.value = withTiming(1, { duration: PRESS_MS, easing: easeOut });
  };

  return { style, onPressIn, onPressOut };
}

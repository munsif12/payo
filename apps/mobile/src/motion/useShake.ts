import { useCallback } from 'react';
import { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { SHAKE_PX, SHAKE_MS } from './config';

const linear = Easing.linear;

// Wrong-PIN shake: 4px, 200ms, then clears. Motion.dc.html "PIN dots" row
// note. Call shake() imperatively (e.g. after a wrong-PIN response).
export function useShake() {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);

  const shake = useCallback(() => {
    if (reducedMotion) return;
    const leg = SHAKE_MS / 4;
    offset.value = withSequence(
      withTiming(-SHAKE_PX, { duration: leg, easing: linear }),
      withTiming(SHAKE_PX, { duration: leg * 2, easing: linear }),
      withTiming(0, { duration: leg, easing: linear }),
    );
  }, [reducedMotion, offset]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return { style, shake };
}

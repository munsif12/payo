import { useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { COUNT_MS } from './config';

const easeOut = Easing.out(Easing.ease);

// Balance update — digits count from the previous value to the new one over
// 250ms ease-out. Motion.dc.html "Balance update" row. Returns the current
// (possibly mid-animation) paisa value to render with formatPaisa().
export function useCountUp(paisa: number, durationMs = COUNT_MS): number {
  const reducedMotion = useReducedMotion();
  const shared = useSharedValue(paisa);
  const first = useRef(true);
  const [display, setDisplay] = useState(paisa);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      shared.value = paisa;
      setDisplay(paisa);
      return;
    }
    if (reducedMotion) {
      shared.value = paisa;
      setDisplay(paisa);
      return;
    }
    shared.value = withTiming(paisa, { duration: durationMs, easing: easeOut });
  }, [paisa, durationMs, reducedMotion, shared]);

  useAnimatedReaction(
    () => Math.round(shared.value),
    (value, prev) => {
      if (value !== prev) runOnJS(setDisplay)(value);
    },
    [],
  );

  return display;
}

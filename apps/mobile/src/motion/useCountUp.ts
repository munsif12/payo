import { useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { COUNT_UP, EASE_OUT } from './config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

// Balance update — digits count from the previous value to the new one over
// COUNT_UP ms ease-out (spec §3). Tabular figures come from Text's `money` variant. Returns the current
// (possibly mid-animation) paisa value to render with formatPaisa().
export function useCountUp(paisa: number, durationMs = COUNT_UP): number {
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

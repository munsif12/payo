import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Mirrors Motion.dc.html's `@media (prefers-reduced-motion: reduce)` rule:
// when true, motion primitives must render opacity-only, no loops.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      setReduced(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

import React, { useEffect, useRef } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { useReducedMotion } from '../motion/useReducedMotion';
import { D_SHEET, D_MICRO, EASE_OUT } from '../motion/config';

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

/** Main.dc.html / HomeListening.dc.html / Wallet.dc.html sheet geometry. */
export const SHEET_RADIUS = 28;
export const SHEET_PADDING_TOP = 14;
export const SHEET_PADDING_H = 18;
/** How far the sheet overlaps the navy head above it. */
export const SHEET_OVERLAP = 14;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
/** Spec §3 D_SHEET: translateY 24 → 0, no overshoot. */
const SETTLE_TRANSLATE_Y = 24;

export interface SheetProps {
  children: React.ReactNode;
  /** Delay before the settle starts — Home lines this up behind the greeting
   *  words (`wordRiseEnd`). */
  delay?: number;
  /** False renders the settled state with no animation. Callers pass
   *  `useFirstPaint()`: a tab re-focus or a re-render must never replay it. */
  animate?: boolean;
  /** Hide the grab handle (the sheet is not draggable — it is the page). */
  handle?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

// Sheet — the cream sheet every v7 screen sits on (spec §4): radius 28, grab
// handle, and a D_SHEET settle from 24 pt on first paint only. Transform only,
// on the UI thread. Reduced motion: a D_MICRO opacity fade, no travel.
export function Sheet({ children, delay = 0, animate = true, handle = true, style, contentStyle, testID }: SheetProps) {
  const { c } = useTheme();
  const reducedMotion = useReducedMotion();
  // Latched at mount: useFirstPaint flips to false right after the first
  // commit, and the settle already scheduled here must survive that.
  const animateRef = useRef(animate);
  const shouldAnimate = animateRef.current;

  const progress = useSharedValue(shouldAnimate ? 0 : 1);

  useEffect(() => {
    if (!shouldAnimate) return;
    if (reducedMotion) {
      progress.value = withDelay(delay, withTiming(1, { duration: D_MICRO }));
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration: D_SHEET, easing: easeOut }));
    // Fixed at mount — a re-render must not restart the settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? progress.value : 1,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - progress.value) * SETTLE_TRANSLATE_Y },
    ],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          flex: 1,
          backgroundColor: c.bg,
          borderTopLeftRadius: SHEET_RADIUS,
          borderTopRightRadius: SHEET_RADIUS,
          paddingTop: SHEET_PADDING_TOP,
          paddingHorizontal: SHEET_PADDING_H,
          overflow: 'hidden',
        },
        style,
        animatedStyle,
      ]}
    >
      {handle ? (
        <View
          style={{
            width: HANDLE_WIDTH,
            height: HANDLE_HEIGHT,
            borderRadius: HANDLE_HEIGHT / 2,
            backgroundColor: c.separator,
            alignSelf: 'center',
            marginBottom: 2,
          }}
        />
      ) : null}
      <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
    </Animated.View>
  );
}

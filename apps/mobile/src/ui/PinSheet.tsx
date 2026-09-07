import React, { useEffect, useRef } from 'react';
import { Modal, PanResponder, Pressable, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { D_SHEET, D_UI, D_MICRO, EASE_OUT, EASE_IN } from '../motion/config';
import { useReducedMotion } from '../motion/useReducedMotion';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';
import { useIsUrdu } from './Text';
import { PinDots, type PinDotsHandle } from './PinDots';
import { Keypad } from './Keypad';
import type { PendingAction } from '../api/types';
import type { PinState } from '../pin/pinReducer';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);
const easeIn = Easing.bezier(EASE_IN[0], EASE_IN[1], EASE_IN[2], EASE_IN[3]);

// HomePinSheet.dc.html geometry.
/** Backdrop rgba(13,42,61,.45) — c.navy is #0D2A3D, so this is its opacity. */
const BACKDROP_OPACITY = 0.45;
/** Sheet: 560 tall, 28 radius on the top corners, 14/20 padding, 22 at the foot. */
const SHEET_HEIGHT = 560;
const SHEET_RADIUS = 28;
const SHEET_PAD_TOP = 14;
const SHEET_PAD_H = 20;
const SHEET_PAD_BOTTOM = 22;
/** Vertical rhythm between the sheet's elements (artboard gap 10, plus the
 *  lock disc's own 6pt offset and the dots' 6/4 margins). Written as explicit
 *  margins rather than a container `gap` so the stack lands on the artboard's
 *  own y-positions: keypad at 184 from the sheet top, Cancel on the 22pt foot. */
const SHEET_GAP = 10;
const LOCK_MARGIN_TOP = SHEET_GAP + 6;
const DOTS_MARGIN_TOP = 6;
const DOTS_MARGIN_BOTTOM = 4;
const CANCEL_GAP = 10;
const HANDLE_W = 36;
const HANDLE_H = 4;
const LOCK_CIRCLE = 56;
const LOCK_GLYPH = 24;
const DOT_SIZE = 16;
const DOT_GAP = 16;
const KEY_SIZE = 72;
/** Spec §3 D_SHEET: the sheet settles from 24 pt, with no overshoot. */
const SHEET_TRAVEL = 24;
const DISMISS_THRESHOLD = 80;

export interface PinSheetProps {
  visible: boolean;
  action: PendingAction | null;
  state: PinState;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClose: () => void;
}

// PinSheet — HomePinSheet.dc.html: a cream 560pt sheet with the grab handle, a
// 56pt amberTint lock disc, "Enter your PIN" at 22/800 over the action summary,
// the dots, the 72pt keypad and the Cancel foot, on a navy .45 backdrop.
// Presentational only — all state (digits/submit/error/locked) lives in
// usePinSheet's reducer, and the shake + lockout behaviour is unchanged.
export function PinSheet({ visible, action, state, onDigit, onBackspace, onClose }: PinSheetProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const reducedMotion = useReducedMotion();
  const dotsRef = useRef<PinDotsHandle>(null);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const scrim = useSharedValue(0);
  const cancelPress = usePressScale();

  useEffect(() => {
    if (visible) {
      // Entrance: EASE_OUT over D_SHEET, translateY 24 → 0 plus the backdrop fade.
      translateY.value = reducedMotion ? 0 : withTiming(0, { duration: D_SHEET, easing: easeOut });
      scrim.value = withTiming(BACKDROP_OPACITY, { duration: reducedMotion ? D_MICRO : D_SHEET, easing: easeOut });
    } else {
      // Exit: EASE_IN, shorter than the entrance (spec §3).
      translateY.value = reducedMotion ? SHEET_TRAVEL : withTiming(SHEET_TRAVEL, { duration: D_UI, easing: easeIn });
      scrim.value = withTiming(0, { duration: reducedMotion ? D_MICRO : D_UI, easing: easeIn });
    }
  }, [visible, reducedMotion, translateY, scrim]);

  useEffect(() => {
    if (state.shakeToken > 0) dotsRef.current?.shake();
  }, [state.shakeToken]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_evt, g) => {
        if (g.dy > 0) translateY.value = g.dy;
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          onClose();
        } else {
          translateY.value = withTiming(0, { duration: D_MICRO, easing: easeOut });
        }
      },
    }),
  ).current;

  if (!action) return null;
  const summary = urdu ? action.summary.ur : action.summary.en;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.navy }, scrimStyle]}
        >
          <Pressable
            testID="pin-sheet-backdrop"
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          accessibilityViewIsModal
          style={[
            {
              // minHeight, not height: the artboard's 560 is the resting size,
              // and an error/lockout line must push the sheet taller rather
              // than be clipped by it.
              minHeight: SHEET_HEIGHT,
              backgroundColor: c.bg,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: SHEET_PAD_TOP,
              paddingHorizontal: SHEET_PAD_H,
              paddingBottom: SHEET_PAD_BOTTOM,
              alignItems: 'center',
            },
            sheetStyle,
          ]}
        >
          <View style={{ width: HANDLE_W, height: HANDLE_H, borderRadius: HANDLE_H / 2, backgroundColor: c.separator }} />

          <View
            style={{
              width: LOCK_CIRCLE, height: LOCK_CIRCLE, borderRadius: LOCK_CIRCLE / 2,
              backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center',
              marginTop: LOCK_MARGIN_TOP,
            }}
          >
            <Lock size={LOCK_GLYPH} color={c.onAmber} strokeWidth={2} />
          </View>

          <Text variant="h2" weight={800} center style={{ marginTop: SHEET_GAP }}>{t('pin.sheetTitle')}</Text>
          <Text variant="sub" color={c.ink2} center style={{ fontSize: 14, marginTop: SHEET_GAP }}>{summary}</Text>

          <PinDots
            ref={dotsRef}
            filled={state.digits.length}
            size={DOT_SIZE}
            gap={DOT_GAP}
            style={{ marginTop: DOTS_MARGIN_TOP, marginBottom: DOTS_MARGIN_BOTTOM }}
          />

          {state.error ? (
            <Text testID="pin-sheet-error" variant="sub" color={c.red} center style={{ marginBottom: SHEET_GAP }}>
              {state.error}
            </Text>
          ) : null}

          <Keypad
            size={KEY_SIZE}
            onDigit={onDigit}
            onBackspace={onBackspace}
            disabled={state.submitting || state.locked}
            style={{ width: '100%' }}
          />

          {/* The foot sits on the sheet's bottom padding whatever is above it. */}
          <AnimatedPressable
            testID="pin-sheet-cancel"
            accessibilityRole="button"
            onPress={onClose}
            onPressIn={cancelPress.onPressIn}
            onPressOut={cancelPress.onPressOut}
            hitSlop={12}
            style={[{ marginTop: 'auto', paddingTop: CANCEL_GAP }, cancelPress.style]}
          >
            <Text variant="sub" color={c.ink2} style={{ fontSize: 14 }}>{t('pin.cancel')}</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

import React, { useEffect, useRef } from 'react';
import { Modal, PanResponder, Pressable, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { space, radius } from '../theme/tokens';
import { CONFIRM_SHEET_MS, CONFIRM_SCRIM_OPACITY, CONFIRM_EXIT_MS } from '../motion/config';
import { useReducedMotion } from '../motion/useReducedMotion';
import { Text } from './Text';
import { useIsUrdu } from './Text';
import { PinDots, type PinDotsHandle } from './PinDots';
import { Keypad } from './Keypad';
import type { PendingAction } from '../api/types';
import type { PinState } from '../pin/pinReducer';

const easeOut = Easing.out(Easing.ease);
const SHEET_OFFSET = 420;
const DISMISS_THRESHOLD = 80;

export interface PinSheetProps {
  visible: boolean;
  action: PendingAction | null;
  state: PinState;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClose: () => void;
}

// PinSheet — Pin.dc.html: lock icon circle, title + action summary subtitle,
// 4 PinDots, 72pt Keypad, error banner. Presentational only — all state
// (digits/submit/error/locked) lives in usePinSheet's reducer.
export function PinSheet({ visible, action, state, onDigit, onBackspace, onClose }: PinSheetProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const reducedMotion = useReducedMotion();
  const dotsRef = useRef<PinDotsHandle>(null);
  const translateY = useSharedValue(SHEET_OFFSET);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = reducedMotion ? 0 : withTiming(0, { duration: CONFIRM_SHEET_MS, easing: easeOut });
      scrim.value = withTiming(CONFIRM_SCRIM_OPACITY, { duration: CONFIRM_SHEET_MS, easing: easeOut });
    } else {
      translateY.value = reducedMotion ? SHEET_OFFSET : withTiming(SHEET_OFFSET, { duration: CONFIRM_EXIT_MS, easing: easeOut });
      scrim.value = withTiming(0, { duration: CONFIRM_EXIT_MS, easing: easeOut });
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
          translateY.value = withTiming(0, { duration: 150, easing: easeOut });
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
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, scrimStyle]}
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
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.card,
              borderTopRightRadius: radius.card,
              padding: space.xl,
              gap: space.l,
              alignItems: 'center',
            },
            sheetStyle,
          ]}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.separator }} />

          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={28} color={c.onAmber} strokeWidth={2.2} />
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text variant="h2" center>{t('pin.sheetTitle')}</Text>
            <Text variant="sub" center style={{ marginTop: 6 }}>{summary}</Text>
          </View>

          <PinDots ref={dotsRef} filled={state.digits.length} size={18} />

          {state.error ? (
            <Text testID="pin-sheet-error" variant="sub" color={c.red} center>{state.error}</Text>
          ) : null}

          <Keypad
            size={72}
            onDigit={onDigit}
            onBackspace={onBackspace}
            disabled={state.submitting || state.locked}
            style={{ width: '100%' }}
          />

          <Pressable testID="pin-sheet-cancel" accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text variant="sub">{t('pin.cancel')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

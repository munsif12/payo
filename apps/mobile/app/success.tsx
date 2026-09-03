import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Share2 } from 'lucide-react-native';
import { Screen, Text, Button, Pill } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space } from '../src/theme/tokens';
import { useReducedMotion } from '../src/motion/useReducedMotion';
import { SUCCESS_CHECK_MS, SUCCESS_TEXT_MS, RISE_TRANSLATE_Y, EASE_OUT } from '../src/motion/config';
import { formatPaisa } from '../src/lib/money';

const easeInOut = Easing.inOut(Easing.ease);
const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

export default function Success() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const { refNo, amountPaisa, summary } = useLocalSearchParams<{ refNo: string; amountPaisa: string; summary?: string }>();
  const reducedMotion = useReducedMotion();
  const checkProgress = useSharedValue(reducedMotion ? 1 : 0);
  // Text block rises SUCCESS_TEXT_MS after the check lands at SUCCESS_CHECK_MS
  // (Motion.dc.html "Success": "check draws + lands first, then amount and ref rise").
  const textProgress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reducedMotion) {
      checkProgress.value = withTiming(1, { duration: SUCCESS_CHECK_MS, easing: easeInOut });
      textProgress.value = withDelay(SUCCESS_CHECK_MS, withTiming(1, { duration: SUCCESS_TEXT_MS, easing: easeOut }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkProgress.value,
    transform: [{ scale: 0.5 + checkProgress.value * 0.5 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - textProgress.value) * RISE_TRANSLATE_Y }],
  }));

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, paddingHorizontal: space.xl }}>
        <Animated.View
          style={[
            { width: 112, height: 112, borderRadius: 56, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' },
            checkStyle,
          ]}
        >
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={40} color={c.white} strokeWidth={3} />
          </View>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', gap: space.m }, textStyle]}>
          <Text variant="h1" center style={{ marginTop: 8 }}>{t('success.title')}</Text>
          <Text variant="sub" center>{summary || t('success.sent')}</Text>
          {amountPaisa ? <Text variant="money">{formatPaisa(Number(amountPaisa))}</Text> : null}
          {refNo ? <Pill label={t('success.refPill', { ref: refNo })} bg={c.surface2} color={c.ink2} height={32} /> : null}
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: 8 }}>
        <Button testID="success-done" label={t('common.done')} onPress={() => router.dismissAll()} />
        <Button
          testID="success-share"
          variant="ghost"
          label={t('success.shareReceipt')}
          icon={<Share2 size={18} color={c.ink3} strokeWidth={2} />}
          onPress={() => {}}
          disabled
        />
        <Text variant="foot" center>{t('common.comingSoon')}</Text>
      </View>
    </Screen>
  );
}

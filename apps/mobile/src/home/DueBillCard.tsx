import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react-native';
import { Text, useIsUrdu } from '../ui';
import { useTheme } from '../theme/useTheme';
import { glassTokens, radius, space, touch } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { dueBillTitle } from './homeGreetingLogic';
import type { DueBill } from '../api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The due-bill card on Home (GLASS-SPEC §2 "Due-bill card", B11): the amber-
 * tinted glass card with the bolt, "K-Electric Rs 4,320 due Oct 12", and the
 * one-line nudge to just say it. Tapping it sends the bill intent as a spoken-
 * style turn, so the assistant's own bill → PIN flow runs. The caller hides it
 * when there is no due bill.
 */
export function DueBillCard({ bill, onIntent, testID = 'home-due-bill' }: {
  bill: DueBill;
  onIntent: (text: string) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const press = usePressScale();
  const title = dueBillTitle(bill, urdu, t);
  const Chevron = urdu ? ChevronLeft : ChevronRight;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={t('home.orb.billHint')}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onIntent(t('home.suggest.bill.intent'));
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          backgroundColor: glassTokens.dueBill.fill,
          borderWidth: glassTokens.line,
          borderColor: glassTokens.dueBill.line,
          borderRadius: radius.card,
          paddingVertical: space.l,
          paddingHorizontal: space.xl,
          minHeight: touch.primary,
          flexDirection: urdu ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: space.m,
        },
        press.style,
      ]}
    >
      <Zap size={22} color={c.amber} strokeWidth={2.2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="hl" weight={700} color={c.ink} style={{ fontSize: 16, lineHeight: urdu ? undefined : 22 }}>
          {title}
        </Text>
        <Text variant="sub" color={c.ink2} style={{ fontSize: 14, lineHeight: urdu ? undefined : 20 }}>
          {t('home.orb.billHint')}
        </Text>
      </View>
      <Chevron size={20} color={c.ink3} strokeWidth={2} />
    </AnimatedPressable>
  );
}

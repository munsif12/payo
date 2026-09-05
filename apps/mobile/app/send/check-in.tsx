import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { Screen, Text, Card, Button, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch } from '../../src/theme/tokens';
import { takeAction, holdAction } from '../../src/store/pendingActionHolder';
import { useCheckInActionMutation, apiErr } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';

// Classic Send's check-in step (spec §1 rule 10) — the same one question and the
// same two answers as the chat `check_in` card, on a full screen. "Yes" cancels the
// send; "No" hands off to whatever gate the RETURNED action names: the waiting screen
// when a guardian has to approve, otherwise the normal confirm + PIN screen.
export default function SendCheckIn() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const action = takeAction(actionId!);
  const [checkIn, { isLoading }] = useCheckInActionMutation();
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action) {
    router.back();
    return null;
  }

  const flags = action.riskFlags ?? [];

  const answer = async (someoneAsked: boolean) => {
    setError(null);
    try {
      const next = await checkIn({ id: action.id, someoneAsked }).unwrap();
      if (someoneAsked) {
        setStopped(true);
        return;
      }
      holdAction(next);
      router.replace(
        next.approval?.status === 'waiting'
          ? { pathname: '/send/waiting', params: { actionId: next.id } }
          : { pathname: '/confirm/[actionId]', params: { actionId: next.id } },
      );
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  if (stopped) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
          <Card style={{ alignItems: 'center', gap: space.m }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={26} color={c.green} strokeWidth={2.4} />
            </View>
            <Text testID="send-check-in-stopped" variant="h2" center>{t('cards.checkIn.stopped')}</Text>
            <Text variant="sub" center>{t('cards.checkIn.stoppedBody')}</Text>
          </Card>
          <Button testID="send-check-in-done" label={t('common.done')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <Card style={{ alignItems: 'center', gap: space.m }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={26} color={c.amberDeep} strokeWidth={2.4} />
          </View>
          <Text variant="hl" center>{urdu ? action.summary.ur : action.summary.en}</Text>
          <Text variant="money" style={{ fontSize: 32, lineHeight: 38 }}>{ltrIsolate(formatPaisa(action.amountPaisa))}</Text>
          <Text variant="h2" center>{t('checkIn.question')}</Text>
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'center' }}>
            {flags.filter((f) => f === 'new_recipient_large' || f === 'pressure_language').map((f) => (
              <Pill
                key={f}
                label={t(f === 'new_recipient_large' ? 'risk.newRecipientLarge' : 'risk.pressureLanguage')}
                bg={c.amberTint}
                color={c.amberDeep}
              />
            ))}
          </View>
        </Card>

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        <View style={{ gap: space.m }}>
          <Button
            testID="send-check-in-yes"
            label={t('cards.checkIn.yes')}
            onPress={() => answer(true)}
            loading={isLoading}
            style={{ minHeight: touch.primary }}
          />
          <Button
            testID="send-check-in-no"
            variant="secondary"
            label={t('cards.checkIn.no')}
            onPress={() => answer(false)}
            disabled={isLoading}
            style={{ minHeight: touch.primary }}
          />
        </View>
      </View>
    </Screen>
  );
}

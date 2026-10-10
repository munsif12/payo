import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { Screen, Text, Card, Button, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { takeAction, holdAction } from '../../src/store/pendingActionHolder';
import { useCheckInActionMutation, apiErr } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';

/**
 * GLASS-SPEC §5 "Scam check-in (B9)": the card wears a tinted header strip —
 * `redTint` fill under a line at the red's 0.35 alpha while the question is
 * open, the green pair once the send is stopped. Neither line has a token
 * (tokens.ts is owned outside this screen), so the two alphas live here.
 */
const STRIP_LINE = {
  alert: 'rgba(240,106,106,0.35)',
  stopped: 'rgba(63,196,138,0.35)',
} as const;
/** The question at 32/800 (B9) — the `money` scale, reused for emphasis. */
const AMOUNT_SIZE = 32;
const AMOUNT_LINE_HEIGHT = 38;

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
  const row = { flexDirection: urdu ? 'row-reverse' : 'row' } as const;

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

  const strip = (tone: 'alert' | 'stopped', icon: React.ReactNode, label: React.ReactNode) => (
    <View
      style={[row, {
        alignItems: 'center', gap: space.s,
        paddingHorizontal: space.xl, paddingVertical: space.m,
        backgroundColor: tone === 'alert' ? c.redTint : c.greenTint,
        borderBottomWidth: glassTokens.line, borderBottomColor: STRIP_LINE[tone],
      }]}
    >
      {icon}
      {label}
    </View>
  );

  if (stopped) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {strip(
              'stopped',
              <ShieldCheck size={22} color={c.green} strokeWidth={2.4} />,
              <Text testID="send-check-in-stopped" variant="hl" weight={700} color={c.green} style={{ flex: 1 }}>{t('cards.checkIn.stopped')}</Text>,
            )}
            <View style={{ padding: space.xl }}>
              <Text variant="body" color={c.ink2}>{t('cards.checkIn.stoppedBody')}</Text>
            </View>
          </Card>
          <Button testID="send-check-in-done" label={t('common.done')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {strip(
            'alert',
            <ShieldAlert size={22} color={c.red} strokeWidth={2.4} />,
            <Text variant="hl" weight={700} color={c.red} style={{ flex: 1 }}>{t('checkIn.title')}</Text>,
          )}
          <View style={{ padding: space.xl, gap: space.m, alignItems: 'center' }}>
            <Text variant="h2" center>{t('checkIn.question')}</Text>
            {flags.some((f) => f === 'new_recipient_large' || f === 'pressure_language') ? (
              <View style={[row, { flexWrap: 'wrap', gap: space.xs, justifyContent: 'center' }]}>
                {flags.filter((f) => f === 'new_recipient_large' || f === 'pressure_language').map((f) => (
                  <Pill
                    key={f}
                    label={t(f === 'new_recipient_large' ? 'risk.newRecipientLarge' : 'risk.pressureLanguage')}
                    bg={c.redTint}
                    color={c.red}
                  />
                ))}
              </View>
            ) : null}
            {/* The summary keeps its own line height: in Urdu it is Nastaliq. */}
            <Text variant="sub" color={c.ink2} center>{urdu ? action.summary.ur : action.summary.en}</Text>
            <Text variant="money" style={{ fontSize: AMOUNT_SIZE, lineHeight: AMOUNT_LINE_HEIGHT }}>{ltrIsolate(formatPaisa(action.amountPaisa))}</Text>

            {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

            {/* Two answers only, both 56 pt: "Yes" stops the send (danger), "No" lets it go on (glass). */}
            <View style={{ alignSelf: 'stretch', gap: space.s, marginTop: space.xs }}>
              <Button
                testID="send-check-in-yes"
                variant="danger"
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
        </Card>
      </View>
    </Screen>
  );
}

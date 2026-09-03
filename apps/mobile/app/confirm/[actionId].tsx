import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X, Lock } from 'lucide-react-native';
import { Screen, Text, Card, Button, PinDots, Keypad, useIsUrdu } from '../../src/ui';
import type { PinDotsHandle } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { takeAction, markActionDone } from '../../src/store/pendingActionHolder';
import { useExecuteActionMutation, useCancelActionMutation, apiErr } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';

const PIN_LENGTH = 4;

export default function ConfirmAction() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const action = takeAction(actionId!);
  const [stage, setStage] = useState<'confirm' | 'pin'>('confirm');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [execute, { isLoading }] = useExecuteActionMutation();
  const [cancel] = useCancelActionMutation();
  const dotsRef = useRef<PinDotsHandle>(null);

  if (!action) {
    router.back();
    return null;
  }

  const summaryText = urdu ? action.summary.ur : action.summary.en;

  const run = async (pinValue?: string) => {
    setError(null);
    try {
      const { transaction } = await execute({ id: action.id, pin: pinValue }).unwrap();
      markActionDone(action.id);
      router.replace({ pathname: '/success', params: { refNo: transaction.refNo, amountPaisa: String(transaction.amountPaisa), summary: summaryText } });
    } catch (e) {
      const err = apiErr(e);
      setPin('');
      if (err.code === 'PIN_LOCKED') {
        setLocked(true);
        setError(err.message);
        return;
      }
      if (err.code === 'INVALID_PIN') {
        setError(t('confirm.wrongPin'));
        dotsRef.current?.shake();
      } else if (err.code === 'ACTION_GONE') {
        setError(t('confirm.expired'));
      } else if (err.code === 'INSUFFICIENT_FUNDS') {
        setError(t('confirm.insufficient'));
      } else {
        setError(err.message);
      }
    }
  };

  const onConfirm = () => {
    if (action.requiresPin) setStage('pin');
    else run();
  };

  const onCancel = async () => {
    cancel(action.id);
    router.back();
  };

  const onDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH || locked || isLoading) return;
    setError(null);
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) run(next);
  };
  const onBackspace = () => {
    if (locked || isLoading) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  if (stage === 'pin') {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: space.l }}>
          <Pressable testID="pin-close" accessibilityRole="button" onPress={() => setStage('confirm')} hitSlop={12} style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={22} color={c.ink} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', gap: space.xxl, paddingTop: space.l }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={28} color={c.onAmber} strokeWidth={2.2} />
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text variant="h2" center>{t('confirm.pin.title')}</Text>
            <Text variant="sub" center style={{ marginTop: 6 }}>{summaryText}</Text>
          </View>

          <PinDots ref={dotsRef} filled={pin.length} />

          {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

          <Keypad
            size={72}
            onDigit={onDigit}
            onBackspace={onBackspace}
            disabled={isLoading || locked}
            style={{ width: '100%' }}
          />

          <Text variant="sub">{t('confirm.pin.forgot')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.xl, paddingVertical: space.xl }}>
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Text variant="hl" center>{summaryText}</Text>
          <Text variant="money" center style={{ marginTop: 6 }}>{formatPaisa(action.amountPaisa)}</Text>
        </Card>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          {action.lines.map((l, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: c.separator,
              }}
            >
              <Text variant="sub">{urdu ? l.label.ur : l.label.en}</Text>
              <Text variant="hl">{l.value}</Text>
            </View>
          ))}
          {action.feePaisa > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.separator }}>
              <Text variant="sub">{t('common.fee')}</Text>
              <Text variant="hl">{formatPaisa(action.feePaisa)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
            <Text variant="hl">{t('confirm.total')}</Text>
            <Text variant="hl">{formatPaisa(action.amountPaisa + action.feePaisa)}</Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <Lock size={18} color={c.ink3} strokeWidth={2} />
          <Text variant="foot" style={{ flex: 1 }}>{t('confirm.pinFootnote')}</Text>
        </View>

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        <View style={{ gap: 8 }}>
          <Button testID="confirm-button" label={action.requiresPin ? t('confirm.confirmWithPin') : t('common.confirm')} onPress={onConfirm} loading={isLoading} />
          <Button testID="cancel-button" variant="ghost" label={t('common.cancel')} onPress={onCancel} />
        </View>
      </ScrollView>
    </Screen>
  );
}

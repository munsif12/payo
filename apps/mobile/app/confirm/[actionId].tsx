import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, MoneyText, Card, PrimaryButton, ErrorBanner, Spacer, Row, useUrdu } from '../../src/components/ui';
import { PinPad, usePinPad } from '../../src/components/PinPad';
import { tokens } from '../../src/theme/tokens';
import { takeAction } from '../../src/store/pendingActionHolder';
import { useExecuteActionMutation, useCancelActionMutation, apiErr } from '../../src/api/client';

export default function ConfirmAction() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const action = takeAction(actionId!);
  const [stage, setStage] = useState<'confirm' | 'pin'>('confirm');
  const { pin, push, pop, clear, complete } = usePinPad();
  const [error, setError] = useState<string | null>(null);
  const [execute, { isLoading }] = useExecuteActionMutation();
  const [cancel] = useCancelActionMutation();

  if (!action) {
    router.back();
    return null;
  }

  const run = async (pinValue?: string) => {
    setError(null);
    try {
      const { transaction } = await execute({ id: action.id, pin: pinValue }).unwrap();
      router.replace({ pathname: '/success', params: { refNo: transaction.refNo, amountPaisa: String(transaction.amountPaisa) } });
    } catch (e) {
      const { code } = apiErr(e);
      clear();
      if (code === 'INVALID_PIN') setError(t('confirm.wrongPin'));
      else if (code === 'ACTION_GONE') setError(t('confirm.expired'));
      else if (code === 'INSUFFICIENT_FUNDS') setError(t('confirm.insufficient'));
      else setError(apiErr(e).message);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        {stage === 'confirm' ? (
          <>
            <T size={tokens.type.h2} center color={tokens.color.textMuted}>{t('confirm.title')}</T>
            <Spacer />
            <Card>
              <T size={tokens.type.h2} center>{urdu ? action.summary.ur : action.summary.en}</T>
              <Spacer h={tokens.space.l} />
              <MoneyText paisa={action.amountPaisa} center color={tokens.color.accent} />
              <Spacer h={tokens.space.l} />
              <View style={{ gap: tokens.space.s }}>
                {action.lines.map((l, i) => (
                  <Row key={i} style={{ justifyContent: 'space-between' }}>
                    <T size={tokens.type.caption} color={tokens.color.textMuted}>{urdu ? l.label.ur : l.label.en}</T>
                    <Mono size={tokens.type.caption}>{l.value}</Mono>
                  </Row>
                ))}
                {action.feePaisa > 0 && (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('common.fee')}</T>
                    <MoneyText paisa={action.feePaisa} size={tokens.type.caption} />
                  </Row>
                )}
              </View>
            </Card>
            <ErrorBanner message={error} />
            <Spacer h={tokens.space.l} />
            <PrimaryButton testID="confirm-button" label={t('common.confirm')} onPress={onConfirm} loading={isLoading} />
            <Spacer h={tokens.space.s} />
            <PrimaryButton testID="cancel-button" label={t('common.cancel')} onPress={onCancel} danger />
          </>
        ) : (
          <>
            <T size={tokens.type.h2} center>{t('confirm.enterPin')}</T>
            <T center color={tokens.color.textMuted}>{urdu ? action.summary.ur : action.summary.en}</T>
            <Spacer h={tokens.space.l} />
            <PinPad pin={pin} onDigit={push} onBackspace={pop} />
            <ErrorBanner message={error} />
            <Spacer />
            <PrimaryButton
              testID="pin-submit"
              label={t('common.confirm')}
              onPress={() => run(pin)}
              disabled={!complete}
              loading={isLoading}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

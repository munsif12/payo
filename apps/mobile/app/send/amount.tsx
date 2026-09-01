import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, PrimaryButton, ErrorBanner, Spacer } from '../../src/components/ui';
import { PinPad } from '../../src/components/PinPad';
import { tokens } from '../../src/theme/tokens';
import { useCreateTransferMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';

export default function SendAmount() {
  const { t } = useTranslation();
  const router = useRouter();
  const { to, label } = useLocalSearchParams<{ to: string; label: string }>();
  const [rupees, setRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createTransfer, { isLoading }] = useCreateTransferMutation();

  const amountPaisa = Number(rupees || '0') * 100;

  const submit = async () => {
    setError(null);
    try {
      const action = await createTransfer({ to: JSON.parse(to!), amountPaisa }).unwrap();
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      const { code, message } = apiErr(e);
      setError(code === 'RECIPIENT_NOT_FOUND' ? t('send.recipientNotFound') : message);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T center color={tokens.color.textMuted}>{t('send.howMuch')}</T>
        <T center size={tokens.type.h2}>{label}</T>
        <Spacer />
        <Mono size={tokens.type.money} weight="800" center color={amountPaisa > 0 ? tokens.color.accent : tokens.color.textMuted}>
          {formatPaisa(amountPaisa)}
        </Mono>
        <Spacer h={tokens.space.l} />
        <PinPad
          pin=""
          onDigit={(d) => setRupees(r => (r + d).replace(/^0+(?=\d)/, '').slice(0, 7))}
          onBackspace={() => setRupees(r => r.slice(0, -1))}
        />
        <ErrorBanner message={error} />
        <PrimaryButton
          testID="amount-next"
          label={t('common.next')}
          onPress={submit}
          disabled={amountPaisa <= 0}
          loading={isLoading}
        />
      </View>
    </Screen>
  );
}

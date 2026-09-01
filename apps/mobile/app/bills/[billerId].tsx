import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, MoneyText, Field, PrimaryButton, Card, ErrorBanner, Spacer, Row } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useLookupBillMutation, usePayBillMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import type { BillLookup } from '../../src/api/types';

export default function BillLookupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { billerId, name, urduName } = useLocalSearchParams<{ billerId: string; name: string; urduName: string }>();
  const [consumerNo, setConsumerNo] = useState('');
  const [bill, setBill] = useState<BillLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookup, { isLoading: looking }] = useLookupBillMutation();
  const [pay, { isLoading: paying }] = usePayBillMutation();

  const onLookup = async () => {
    setError(null);
    try {
      setBill(await lookup({ billerId: billerId!, consumerNo }).unwrap());
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  const onPay = async () => {
    setError(null);
    try {
      const action = await pay({ billId: bill!.billId }).unwrap();
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      setError(apiErr(e).code === 'ALREADY_PAID' ? t('bills.alreadyPaid') : apiErr(e).message);
    }
  };

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{urduName || name}</T>
      <Field
        testID="consumer-no"
        placeholder={t('bills.consumerNo')}
        keyboardType="number-pad"
        value={consumerNo}
        onChangeText={(v) => { setConsumerNo(v); setBill(null); }}
      />
      <Spacer />
      {!bill && (
        <PrimaryButton
          testID="bill-lookup"
          label={t('bills.lookup')}
          onPress={onLookup}
          disabled={!/^\d{10,14}$/.test(consumerNo)}
          loading={looking}
        />
      )}
      <ErrorBanner message={error} />
      {bill && (
        <View>
          <Card>
            <T size={tokens.type.h2} center>{bill.consumerName}</T>
            <MoneyText paisa={bill.amountPaisa} center color={tokens.color.accent} />
            <Spacer />
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('bills.month')}</T>
              <Mono size={tokens.type.caption}>{bill.month}</Mono>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('bills.dueDate')}</T>
              <Mono size={tokens.type.caption}>{bill.dueDate.slice(0, 10)}</Mono>
            </Row>
          </Card>
          <Spacer />
          <PrimaryButton testID="bill-pay" label={t('bills.payNow')} onPress={onPay} loading={paying} />
        </View>
      )}
    </Screen>
  );
}

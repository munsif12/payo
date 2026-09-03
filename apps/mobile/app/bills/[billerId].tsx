import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Input, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useLookupBillMutation, usePayBillMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import type { BillLookup } from '../../src/api/types';

export default function BillLookupScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { billerId, name, urduName, consumerNo: initialConsumerNo } =
    useLocalSearchParams<{ billerId: string; name: string; urduName: string; consumerNo?: string }>();
  // Deep-linked from the Bills "Pay now" due-bill card, which already knows
  // the consumer number — pre-fill it (does not auto-run the lookup).
  const [consumerNo, setConsumerNo] = useState(initialConsumerNo ?? '');
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="bill-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{urduName || name}</Text>
      </View>

      <View style={{ gap: space.m }}>
        <Input
          testID="consumer-no"
          placeholder={t('bills.consumerNo')}
          keyboardType="number-pad"
          value={consumerNo}
          onChangeText={(v) => { setConsumerNo(v); setBill(null); }}
        />

        {!bill && (
          <Button
            testID="bill-lookup"
            label={t('bills.lookup')}
            onPress={onLookup}
            disabled={!/^\d{10,14}$/.test(consumerNo)}
            loading={looking}
          />
        )}

        {error ? <Text color={c.red} center>{error}</Text> : null}

        {bill && (
          <View style={{ gap: space.l }}>
            <Card style={{ alignItems: 'center', gap: space.s }}>
              <Text variant="h2" center>{bill.consumerName}</Text>
              <Text variant="money" center color={c.amberDeep}>{ltrIsolate(formatPaisa(bill.amountPaisa))}</Text>
              <View style={{ alignSelf: 'stretch', marginTop: space.m, gap: space.s }}>
                <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                  <Text variant="cap">{t('bills.month')}</Text>
                  <Text variant="foot" color={c.ink}>{bill.month}</Text>
                </View>
                <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                  <Text variant="cap">{t('bills.dueDate')}</Text>
                  <Text variant="foot" color={c.ink}>{ltrIsolate(bill.dueDate.slice(0, 10))}</Text>
                </View>
              </View>
            </Card>
            <Button testID="bill-pay" label={t('bills.payNow')} onPress={onPay} loading={paying} />
          </View>
        )}
      </View>
    </Screen>
  );
}

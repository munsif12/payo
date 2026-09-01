import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, PrimaryButton, ListRow, ErrorBanner, Spacer, Row, useUrdu } from '../src/components/ui';
import { tokens } from '../src/theme/tokens';
import { useTelcosQuery, useCreateRechargeMutation, apiErr } from '../src/api/client';
import { holdAction } from '../src/store/pendingActionHolder';

const PRESETS_RS = [100, 500, 1000];

export default function Recharge() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const [telcoId, setTelcoId] = useState<string | null>(null);
  const [phone, setPhone] = useState('+92');
  const [rupees, setRupees] = useState('500');
  const [error, setError] = useState<string | null>(null);
  const { data: telcos } = useTelcosQuery();
  const [createRecharge, { isLoading }] = useCreateRechargeMutation();

  const submit = async () => {
    setError(null);
    try {
      const action = await createRecharge({ telcoId: telcoId!, phone, amountPaisa: Number(rupees) * 100 }).unwrap();
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('recharge.title')}</T>
      <ScrollView>
        <T color={tokens.color.textMuted}>{t('recharge.chooseTelco')}</T>
        <Spacer h={tokens.space.s} />
        {(telcos?.items ?? []).map(tc => (
          <ListRow
            key={tc.id}
            testID={`telco-${tc.name}`}
            onPress={() => setTelcoId(tc.id)}
            left={<T size={22}>{telcoId === tc.id ? '✅' : '📱'}</T>}
            title={<T>{urdu ? tc.urduName : tc.name}</T>}
          />
        ))}
        <Field testID="recharge-phone" placeholder={t('recharge.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Spacer h={tokens.space.s} />
        <Row>
          {PRESETS_RS.map(rs => (
            <View key={rs} style={{ flex: 1 }}>
              <T
                center
                color={rupees === String(rs) ? tokens.color.bg : tokens.color.text}
                style={{
                  backgroundColor: rupees === String(rs) ? tokens.color.accent : tokens.color.surface,
                  borderRadius: tokens.radius.pill, overflow: 'hidden', paddingVertical: tokens.space.s,
                }}
                // @ts-expect-error Text onPress
                onPress={() => setRupees(String(rs))}
              >
                {'₨' + rs}
              </T>
            </View>
          ))}
        </Row>
        <Spacer h={tokens.space.s} />
        <Field testID="recharge-amount" keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
        <ErrorBanner message={error} />
        <Spacer />
        <PrimaryButton
          testID="recharge-next"
          label={t('common.next')}
          onPress={submit}
          disabled={!telcoId || !/^\+92\d{10}$/.test(phone) || !(Number(rupees) >= 50 && Number(rupees) <= 5000)}
          loading={isLoading}
        />
      </ScrollView>
    </Screen>
  );
}

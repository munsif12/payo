import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react-native';
import { Screen, Text, Input, ListRow, Chip, Button, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space } from '../src/theme/tokens';
import { useTelcosQuery, useCreateRechargeMutation, apiErr } from '../src/api/client';
import { holdAction } from '../src/store/pendingActionHolder';
import { formatPaisa } from '../src/lib/money';

const PRESETS_RS = [100, 500, 1000];

export default function Recharge() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
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
      <Text variant="h1" style={{ paddingTop: space.l, marginBottom: space.l }}>{t('recharge.title')}</Text>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Text variant="sub">{t('recharge.chooseTelco')}</Text>
        {(telcos?.items ?? []).map((tc) => (
          <ListRow
            key={tc.id}
            testID={`telco-${tc.name}`}
            onPress={() => setTelcoId(tc.id)}
            left={
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: telcoId === tc.id ? c.amberTint : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={20} color={telcoId === tc.id ? c.onAmber : c.ink2} strokeWidth={2.2} />
              </View>
            }
            title={urdu ? tc.urduName : tc.name}
          />
        ))}
        <Input testID="recharge-phone" placeholder={t('recharge.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESETS_RS.map((rs) => (
            <Chip key={rs} label={formatPaisa(rs * 100)} selected={rupees === String(rs)} onPress={() => setRupees(String(rs))} />
          ))}
        </View>
        <Input testID="recharge-amount" keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
        <Button
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

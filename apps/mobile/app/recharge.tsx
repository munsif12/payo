import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Smartphone } from 'lucide-react-native';
import { Screen, Text, Input, Chip, Button, InstitutionLogo, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../src/theme/tokens';
import { useTelcosQuery, useCreateRechargeMutation, apiErr } from '../src/api/client';
import { holdAction } from '../src/store/pendingActionHolder';
import { formatPaisa } from '../src/lib/money';
import { ltrIsolate } from '../src/lib/bidi';

const PRESETS_RS = [100, 300, 500, 1000];
const MIN_RS = 50;
const MAX_RS = 5000;
const TILE_MIN_HEIGHT = 96;

// Top-up — GLASS-SPEC §5 B25: the operators as glass tiles (`InstitutionLogo`,
// the chosen one wears the 1.5 px amber line), the number `Input`, amount chips,
// and the amber "Top-up ₨500" primary with the voice hint.
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
  const rowDir = urdu ? 'row-reverse' : 'row';

  const amountValid = Number(rupees) >= MIN_RS && Number(rupees) <= MAX_RS;

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
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="recharge-back"
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface,
            borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={22} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" numberOfLines={1}>{t('recharge.title')}</Text>
          <Text variant="sub" numberOfLines={1}>{t('recharge.subtitle')}</Text>
        </View>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <View style={{ gap: space.s }}>
          <Text variant="cap">{t('recharge.chooseTelco')}</Text>
          <View style={{ flexDirection: rowDir, gap: space.s }}>
            {(telcos?.items ?? []).map((tc) => {
              const selected = telcoId === tc.id;
              return (
                <Pressable
                  key={tc.id}
                  testID={`telco-${tc.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTelcoId(tc.id)}
                  style={{
                    flex: 1, minHeight: TILE_MIN_HEIGHT, borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 4,
                    backgroundColor: selected ? c.surface2 : c.surface,
                    borderWidth: selected ? glassTokens.inputFocusLine : glassTokens.line,
                    borderColor: selected ? c.amber : c.separator,
                    alignItems: 'center', justifyContent: 'center', gap: space.s,
                  }}
                >
                  <InstitutionLogo size={40} shape="rounded" name={tc.name} code={tc.code ?? tc.id} logoUrl={tc.logoUrl} />
                  <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} adjustsFontSizeToFit>{urdu ? tc.urduName : tc.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          testID="recharge-phone"
          icon={<Smartphone size={20} color={c.ink3} strokeWidth={2} />}
          placeholder={t('recharge.phone')}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <View style={{ gap: space.s }}>
          <Text variant="cap">{t('common.amount')}</Text>
          <View style={{ flexDirection: rowDir, gap: space.s }}>
            {PRESETS_RS.map((rs) => (
              <Chip key={rs} label={formatPaisa(rs * 100)} selected={rupees === String(rs)} onPress={() => setRupees(String(rs))} style={{ flex: 1, paddingHorizontal: 6 }} />
            ))}
          </View>
          <Input testID="recharge-amount" keyboardType="number-pad" placeholder={t('common.amount')} value={rupees} onChangeText={setRupees} />
        </View>

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
        <Button
          testID="recharge-next"
          label={amountValid ? t('recharge.topUpAmount', { amount: ltrIsolate(formatPaisa(Number(rupees) * 100)) }) : t('common.next')}
          onPress={submit}
          disabled={!telcoId || !/^\+92\d{10}$/.test(phone) || !amountValid}
          loading={isLoading}
        />
        <Text variant="foot" color={c.ink3} center>{t('recharge.hint')}</Text>
      </ScrollView>
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Wallet } from 'lucide-react-native';
import { Screen, Text, Button, Keypad } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useRequestOtpMutation, apiErr } from '../../src/api/client';
import { otpRequested } from '../../src/store/authSlice';

const MAX_DIGITS = 10;

// Groups a run of up to 10 digits as "300 111 0001" — Phone.dc.html.
function groupDigits(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
}

export default function Phone() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestOtp, { isLoading }] = useRequestOtpMutation();

  const onDigit = (d: string) => {
    if (digits.length >= MAX_DIGITS) return;
    setError(null);
    setDigits((p) => p + d);
  };
  const onBackspace = () => {
    setError(null);
    setDigits((p) => p.slice(0, -1));
  };

  const submit = async () => {
    const phone = `+92${digits}`;
    setError(null);
    try {
      const data = await requestOtp({ phone }).unwrap();
      dispatch(otpRequested({ phone }));
      router.push({ pathname: '/(auth)/otp', params: { demoOtp: data.demoOtp } });
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 22, paddingTop: space.xxxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={22} color={c.navy} strokeWidth={2.4} />
          </View>
          <Text variant="h2" weight={800} style={{ letterSpacing: 1 }}>{t('appName')}</Text>
        </View>

        <View>
          <Text variant="h1">{t('auth.phone.title')}</Text>
          <Text variant="sub" style={{ marginTop: 6 }}>{t('auth.phone.subtitle')}</Text>
        </View>

        {/* A phone number reads left-to-right regardless of UI language (Foundations.dc.html
            `.num`), so this row is deliberately NOT mirrored for Urdu/RTL. */}
        <View
          style={{
            height: 60, borderRadius: 16, backgroundColor: c.surface,
            borderWidth: 1.5, borderColor: c.amber,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12, borderRightWidth: 1, borderRightColor: c.separator }}>
            <Text variant="hl" weight={600} style={{ writingDirection: 'ltr', textAlign: 'left' }}>PK +92</Text>
          </View>
          <Text
            variant="hl"
            weight={600}
            color={digits ? c.ink : c.ink3}
            style={{ fontSize: 20, letterSpacing: 1, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'left' }}
            testID="phone-digits"
          >
            {digits ? groupDigits(digits) : '300 000 0000'}
          </Text>
        </View>

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: 16, padding: 14 }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : null}

        <Keypad onDigit={onDigit} onBackspace={onBackspace} disabled={isLoading} />

        <Button
          testID="phone-submit"
          label={t('auth.phone.sendCode')}
          onPress={submit}
          disabled={digits.length !== MAX_DIGITS}
          loading={isLoading}
        />

        <Text variant="foot" center>{t('auth.phone.terms')}</Text>
      </View>
    </Screen>
  );
}

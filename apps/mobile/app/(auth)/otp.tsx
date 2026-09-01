import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Screen, T, Mono, Field, PrimaryButton, ErrorBanner, Spacer, Card } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useVerifyOtpMutation, apiErr } from '../../src/api/client';
import { signedIn } from '../../src/store/authSlice';

export default function Otp() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const { userId, demoOtp } = useLocalSearchParams<{ userId: string; demoOtp: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verify, { isLoading }] = useVerifyOtpMutation();

  const submit = async () => {
    setError(null);
    try {
      const data = await verify({ userId: userId!, otp: code }).unwrap();
      dispatch(signedIn(data));
      router.replace('/(tabs)');
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T size={tokens.type.h1} center>{t('auth.otpTitle')}</T>
        <T center color={tokens.color.textMuted}>{t('auth.otpHint')}</T>
        <Spacer h={tokens.space.l} />
        <Card style={{ alignItems: 'center' }}>
          <Mono size={40} weight="800" color={tokens.color.accent} center>{demoOtp}</Mono>
        </Card>
        <Spacer h={tokens.space.l} />
        <Field
          testID="otp-input"
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={{ textAlign: 'center', fontSize: 28, letterSpacing: 8 }}
        />
        <ErrorBanner message={error} />
        <Spacer />
        <PrimaryButton testID="otp-submit" label={t('auth.verify')} onPress={submit} disabled={code.length !== 6} loading={isLoading} />
      </View>
    </Screen>
  );
}

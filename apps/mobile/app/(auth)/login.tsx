import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Screen, T, Field, PrimaryButton, ErrorBanner, Spacer } from '../../src/components/ui';
import { PinPad, usePinPad } from '../../src/components/PinPad';
import { tokens } from '../../src/theme/tokens';
import { useLoginMutation, apiErr } from '../../src/api/client';
import { signedIn } from '../../src/store/authSlice';
import i18n from '../../src/i18n';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const { pin, push, pop, clear } = usePinPad();
  const [error, setError] = useState<string | null>(null);
  const [login, { isLoading }] = useLoginMutation();

  const submit = async () => {
    setError(null);
    try {
      const data = await login({ email: email.trim().toLowerCase(), pin }).unwrap();
      if (data.user.language) i18n.changeLanguage(data.user.language);
      dispatch(signedIn(data));
      router.replace('/(tabs)');
    } catch (e) {
      clear();
      setError(apiErr(e).code === 'NETWORK' ? apiErr(e).message : t('auth.wrongCreds'));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <T size={tokens.type.h1} center>{t('auth.welcome')}</T>
          <T size={tokens.type.caption} color={tokens.color.textMuted} center>{t('auth.tagline')}</T>
          <Spacer h={tokens.space.xl} />
          <Field
            testID="login-email"
            placeholder={t('auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Spacer />
          <T center color={tokens.color.textMuted}>{t('auth.pin')}</T>
          <Spacer />
          <PinPad pin={pin} onDigit={push} onBackspace={pop} />
          <ErrorBanner message={error} />
          <PrimaryButton
            testID="login-submit"
            label={t('auth.login')}
            onPress={submit}
            disabled={!email.includes('@') || pin.length < 4}
            loading={isLoading}
          />
          <Spacer />
          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <T center color={tokens.color.accent}>{t('auth.newAccount')}</T>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

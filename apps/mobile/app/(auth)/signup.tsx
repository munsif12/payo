import React, { useState } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, PrimaryButton, ErrorBanner, Spacer } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useSignupMutation, apiErr } from '../../src/api/client';

export default function Signup() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', urduName: '', email: '', phone: '+92', pin: '' });
  const [error, setError] = useState<string | null>(null);
  const [signup, { isLoading }] = useSignupMutation();

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    try {
      const data = await signup({
        name: form.name.trim(), urduName: form.urduName.trim() || undefined,
        email: form.email.trim().toLowerCase(), phone: form.phone.trim(), pin: form.pin,
      }).unwrap();
      router.push({ pathname: '/(auth)/otp', params: { userId: data.userId, demoOtp: data.demoOtp } });
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  const valid = form.name && form.email.includes('@') && /^\+92\d{10}$/.test(form.phone) && /^\d{4}$/.test(form.pin);

  return (
    <Screen>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: tokens.space.xl }}>
        <T size={tokens.type.h1} center>{t('auth.signup')}</T>
        <Spacer h={tokens.space.xl} />
        <Field testID="signup-name" placeholder={t('auth.name')} value={form.name} onChangeText={set('name')} />
        <Spacer h={tokens.space.s} />
        <Field testID="signup-urduName" placeholder={t('auth.urduName')} value={form.urduName} onChangeText={set('urduName')} rtl />
        <Spacer h={tokens.space.s} />
        <Field testID="signup-email" placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set('email')} />
        <Spacer h={tokens.space.s} />
        <Field testID="signup-phone" placeholder={t('auth.phone')} keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} />
        <Spacer h={tokens.space.s} />
        <Field testID="signup-pin" placeholder={t('auth.choosePin')} keyboardType="number-pad" secureTextEntry maxLength={4} value={form.pin} onChangeText={set('pin')} />
        <ErrorBanner message={error} />
        <Spacer />
        <PrimaryButton testID="signup-submit" label={t('auth.signup')} onPress={submit} disabled={!valid} loading={isLoading} />
        <Spacer />
        <Pressable onPress={() => router.back()}>
          <T center color={tokens.color.accent}>{t('auth.haveAccount')}</T>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

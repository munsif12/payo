import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { Screen, Text, Button, Keypad } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import type { RootState } from '../../src/store';
import { useRequestOtpMutation, useVerifyOtpMutation, apiErr } from '../../src/api/client';
import { otpVerified, pendingNameLoaded, getCachedName } from '../../src/store/authSlice';
import { ltrIsolate } from '../../src/lib/bidi';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 42;

const formatCountdown = (s: number) => `0:${String(s).padStart(2, '0')}`;

export default function Otp() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const { demoOtp: initialDemoOtp } = useLocalSearchParams<{ demoOtp: string }>();
  const pendingPhone = useSelector((s: RootState) => s.auth.pendingPhone);

  const [demoOtp, setDemoOtp] = useState(initialDemoOtp ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [requestOtp, { isLoading: isResending }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const onDigit = (d: string) => {
    if (code.length >= CODE_LENGTH || locked) return;
    setError(null);
    setCode((p) => p + d);
  };
  const onBackspace = () => {
    if (locked) return;
    setError(null);
    setCode((p) => p.slice(0, -1));
  };

  const resend = async () => {
    if (seconds > 0 || isResending || !pendingPhone || locked) return;
    setError(null);
    setCode('');
    try {
      const data = await requestOtp({ phone: pendingPhone }).unwrap();
      setDemoOtp(data.demoOtp);
      setSeconds(RESEND_SECONDS);
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  const submit = async () => {
    if (!pendingPhone) return;
    setError(null);
    try {
      const data = await verifyOtp({ phone: pendingPhone, otp: code }).unwrap();
      dispatch(otpVerified({ otpToken: data.otpToken, isNewUser: data.isNewUser }));
      const cachedName = await getCachedName(pendingPhone);
      dispatch(pendingNameLoaded(cachedName));
      router.replace(data.isNewUser ? '/(auth)/create-pin' : '/(auth)/enter-pin');
    } catch (e) {
      const err = apiErr(e);
      setCode('');
      setError(err.message);
      if (err.code === 'OTP_LOCKED') setLocked(true);
    }
  };

  return (
    <Screen>
      <View style={{ paddingTop: space.xl, gap: 22 }}>
        <Pressable testID="otp-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ paddingVertical: 4 }}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>

        <View>
          <Text variant="h1">{t('auth.otp.title')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Text variant="sub">{t('auth.otp.sentTo', { phone: ltrIsolate(pendingPhone ?? '') })}</Text>
            <Text variant="sub">·</Text>
            <Pressable testID="otp-change" onPress={() => router.back()} hitSlop={8}>
              <Text variant="sub" weight={700} color={c.amberDeep}>{t('auth.otp.change')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <View
              key={i}
              testID={`otp-box-${i}`}
              style={{
                flex: 1, height: 60, borderRadius: 14, backgroundColor: c.surface,
                borderWidth: 1.5, borderColor: code[i] ? c.amber : c.separator,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="h2" weight={700} style={{ writingDirection: 'ltr' }}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: 16, padding: 14 }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: c.amberTint, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} color={c.onAmber} strokeWidth={2.2} />
            <Text variant="sub" weight={600} color={c.onAmber} style={{ flex: 1 }}>
              {t('auth.otp.demoCode', { code: ltrIsolate(demoOtp) })}
            </Text>
          </View>
        )}

        <Keypad
          onDigit={onDigit}
          onBackspace={onBackspace}
          disabled={isVerifying || locked}
          leftSlot={
            seconds > 0 || locked ? (
              <Text variant="foot" color={c.ink2}>{t('auth.otp.resend', { time: ltrIsolate(formatCountdown(seconds)) })}</Text>
            ) : (
              <Pressable testID="otp-resend" onPress={resend} hitSlop={8} disabled={isResending}>
                <Text variant="foot" weight={700} color={c.amberDeep}>{t('auth.otp.resendNow')}</Text>
              </Pressable>
            )
          }
        />

        <Button
          testID="otp-submit"
          label={t('auth.otp.verify')}
          onPress={submit}
          disabled={code.length !== CODE_LENGTH || locked}
          loading={isVerifying}
        />
      </View>
    </Screen>
  );
}

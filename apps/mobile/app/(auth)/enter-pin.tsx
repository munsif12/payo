import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Screen, Text, PinDots, Keypad, useIsUrdu } from '../../src/ui';
import type { PinDotsHandle } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';
import type { RootState } from '../../src/store';
import { useVerifyPinWithOtpMutation, apiErr } from '../../src/api/client';
import { signedIn, cacheUserName, pendingCleared } from '../../src/store/authSlice';
import { BrandMark } from './phone';

const PIN_LENGTH = 4;

// Enter PIN — GLASS-SPEC §5 B8: orb + wordmark, "Welcome back" title, amber /
// glass PIN dots, the 72 pt glass keypad, "Forgot PIN?" as an amber ghost link,
// and the typed-never-spoken footnote.
export default function EnterPin() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const dispatch = useDispatch();
  const otpToken = useSelector((s: RootState) => s.auth.otpToken);
  const pendingPhone = useSelector((s: RootState) => s.auth.pendingPhone);
  const pendingName = useSelector((s: RootState) => s.auth.pendingName);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [verifyPin, { isLoading }] = useVerifyPinWithOtpMutation();
  const dotsRef = useRef<PinDotsHandle>(null);

  const notYou = () => {
    dispatch(pendingCleared());
    router.replace('/(auth)/phone');
  };

  const submit = async (fullPin: string) => {
    if (!otpToken) return;
    setError(null);
    try {
      const data = await verifyPin({ pin: fullPin, otpToken }).unwrap();
      await cacheUserName(pendingPhone ?? data.user.phone, data.user.name);
      dispatch(signedIn({ token: data.token, user: data.user }));
      router.replace('/(tabs)');
    } catch (e) {
      const err = apiErr(e);
      setPin('');
      if (err.code === 'PIN_LOCKED') {
        setLocked(true);
        setError(err.message);
        return;
      }
      // The otpToken this screen relies on has expired or is no longer valid
      // (anything other than a locked-out or mistyped PIN) — the session
      // can't be recovered here, so clear it and send the user back to
      // verify their number again, mirroring create-pin.tsx's handling.
      if (err.code === 'OTP_SCOPE' || err.code === 'UNAUTHORIZED') {
        dispatch(pendingCleared());
        router.replace({ pathname: '/(auth)/phone', params: { expired: '1' } });
        return;
      }
      dotsRef.current?.shake();
    }
  };

  const onDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH || locked) return;
    setError(null);
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };
  const onBackspace = () => {
    if (locked) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  const firstName = pendingName ? pendingName.trim().split(/\s+/)[0] : null;

  return (
    <Screen>
      <View style={{ paddingTop: space.xl, gap: space.l, alignItems: 'center' }}>
        <BrandMark center />

        <View>
          <Text variant="h1" center style={{ fontSize: 32, lineHeight: urdu ? undefined : 38 }}>
            {firstName ? t('auth.pin.welcomeBack', { name: firstName }) : t('auth.pin.welcomeGeneric')}
          </Text>
          <Text variant="body" color={c.ink2} center style={{ marginTop: 6 }}>{t('auth.pin.enterToOpen')}</Text>
        </View>

        <PinDots ref={dotsRef} filled={pin.length} size={20} gap={24} />

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: radius.input, padding: 14, width: '100%' }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : null}

        <Keypad
          size={72}
          onDigit={onDigit}
          onBackspace={onBackspace}
          disabled={isLoading || locked}
          style={{ width: '100%' }}
        />

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Pressable testID="enter-pin-forgot" accessibilityRole="button" onPress={notYou} hitSlop={8}>
            <Text variant="sub" weight={700} color={c.amber}>{t('auth.pin.forgot')}</Text>
          </Pressable>
          <Text variant="sub" color={c.ink3}>·</Text>
          <Pressable testID="enter-pin-not-you" accessibilityRole="button" onPress={notYou} hitSlop={8}>
            <Text variant="sub" color={c.ink2}>{t('auth.pin.notYou')}</Text>
          </Pressable>
        </View>

        <Text variant="foot" color={c.ink3} center>{t('auth.pin.typedNotSpoken')}</Text>
      </View>
    </Screen>
  );
}

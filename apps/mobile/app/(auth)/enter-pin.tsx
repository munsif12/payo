import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { User } from 'lucide-react-native';
import { Screen, Text, Avatar, PinDots, Keypad } from '../../src/ui';
import type { PinDotsHandle } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import type { RootState } from '../../src/store';
import { useVerifyPinWithOtpMutation, apiErr } from '../../src/api/client';
import { signedIn, cacheUserName, pendingCleared } from '../../src/store/authSlice';
import { ltrIsolate } from '../../src/lib/bidi';

const PIN_LENGTH = 4;

export default function EnterPin() {
  const { t } = useTranslation();
  const { c } = useTheme();
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
      <View style={{ paddingTop: space.xl, gap: 26, alignItems: 'center' }}>
        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            testID="enter-pin-not-you"
            accessibilityRole="button"
            onPress={notYou}
            style={{
              height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.surface2,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <User size={16} color={c.ink2} strokeWidth={2} />
            <Text variant="sub" weight={600} color={c.ink2} style={{ lineHeight: undefined, fontSize: 14 }}>
              {t('auth.pin.notYou')}
            </Text>
          </Pressable>
        </View>

        <Avatar name={pendingName ?? 'PAYO user'} size={72} />

        <View>
          <Text variant="h1" center>
            {firstName ? t('auth.pin.welcomeBack', { name: firstName }) : t('auth.pin.welcomeGeneric')}
          </Text>
          <Text variant="sub" center style={{ marginTop: 6 }}>{t('auth.pin.enterToOpen')}</Text>
        </View>

        <PinDots ref={dotsRef} filled={pin.length} />

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: 16, padding: 14, width: '100%' }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : null}

        <Keypad
          size={72}
          onDigit={onDigit}
          onBackspace={onBackspace}
          disabled={isLoading || locked}
          style={{ width: '100%' }}
          leftSlot={
            <Pressable testID="enter-pin-forgot" onPress={notYou} hitSlop={8}>
              <Text variant="foot" color={c.ink2}>{t('auth.pin.forgot')}</Text>
            </Pressable>
          }
        />

        <Text variant="foot" center>{t('auth.pin.numberVerified', { phone: ltrIsolate(pendingPhone ?? '') })}</Text>
      </View>
    </Screen>
  );
}

import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, Check, Shield } from 'lucide-react-native';
import { Screen, Text, Button, Card, Chip, Pill, PinDots, Keypad } from '../../src/ui';
import type { PinDotsHandle } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import type { RootState } from '../../src/store';
import { useSetPinMutation, apiErr } from '../../src/api/client';
import { signedIn, cacheUserName, otpVerified, pendingCleared } from '../../src/store/authSlice';

const PIN_LENGTH = 4;

export default function CreatePin() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const otpToken = useSelector((s: RootState) => s.auth.otpToken);
  const pendingPhone = useSelector((s: RootState) => s.auth.pendingPhone);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [setPin, { isLoading }] = useSetPinMutation();
  const confirmDotsRef = useRef<PinDotsHandle>(null);

  const newComplete = newPin.length === PIN_LENGTH;
  const active: 'new' | 'confirm' = newComplete ? 'confirm' : 'new';

  const finish = async (pin: string, confirm: string) => {
    if (!otpToken) return;
    setError(null);
    try {
      const data = await setPin({ pin, otpToken }).unwrap();
      await cacheUserName(pendingPhone ?? data.user.phone, data.user.name);
      dispatch(signedIn({ token: data.token, user: data.user }));
      router.replace('/(tabs)');
    } catch (e) {
      const err = apiErr(e);
      if (err.code === 'PIN_ALREADY_SET') {
        // Session already completed PIN setup (e.g. a retried request) — this account
        // signs in via Enter PIN now, not Create PIN.
        dispatch(otpVerified({ otpToken, isNewUser: false }));
        router.replace('/(auth)/enter-pin');
        return;
      }
      if (err.code === 'OTP_SCOPE' || err.code === 'UNAUTHORIZED') {
        dispatch(pendingCleared());
        router.replace('/(auth)/phone');
        return;
      }
      setError(err.message);
      setConfirmPin('');
      confirmDotsRef.current?.shake();
    }
  };

  const onDigit = (d: string) => {
    setError(null);
    if (active === 'new') {
      if (newPin.length < PIN_LENGTH) setNewPin(newPin + d);
      return;
    }
    if (confirmPin.length >= PIN_LENGTH) return;
    const next = confirmPin + d;
    setConfirmPin(next);
    // Give immediate feedback on a mismatch; a match just enables the Finish
    // button below — the user still taps it (mirrors the artboard, which
    // shows Finish as a live button rather than auto-submitting).
    if (next.length === PIN_LENGTH && next !== newPin) {
      confirmDotsRef.current?.shake();
      setTimeout(() => setConfirmPin(''), 220);
    }
  };

  const onBackspace = () => {
    setError(null);
    if (active === 'confirm' && confirmPin.length === 0) {
      setNewPin((p) => p.slice(0, -1));
      return;
    }
    if (active === 'new') { setNewPin((p) => p.slice(0, -1)); return; }
    setConfirmPin((p) => p.slice(0, -1));
  };

  const canFinish = newComplete && confirmPin.length === PIN_LENGTH && confirmPin === newPin;

  return (
    <Screen>
      <View style={{ paddingTop: space.xl, gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable testID="create-pin-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ paddingVertical: 4 }}>
            <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
          </Pressable>
          <Chip label={t('auth.pin.step', { n: 3, total: 3 })} />
        </View>

        <View>
          <Text variant="h1">{t('auth.pin.createTitle')}</Text>
          <Text variant="sub" style={{ marginTop: 6 }}>{t('auth.pin.createSubtitle')}</Text>
        </View>

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="hl">{t('auth.pin.newPin')}</Text>
            {newComplete ? (
              <Pill label={t('auth.pin.set')} bg={c.greenTint} color={c.green} icon={<Check size={14} color={c.green} strokeWidth={3} />} />
            ) : (
              <Text variant="foot">{t('auth.pin.progress', { n: newPin.length })}</Text>
            )}
          </View>
          <PinDots filled={newPin.length} gap={16} />

          <View style={{ height: 1, backgroundColor: c.separator }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="hl">{t('auth.pin.confirmPin')}</Text>
            <Text variant="foot">{t('auth.pin.progress', { n: confirmPin.length })}</Text>
          </View>
          <PinDots ref={confirmDotsRef} filled={confirmPin.length} gap={16} />
        </Card>

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: 16, padding: 14 }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
            <Shield size={18} color={c.ink3} strokeWidth={2} />
            <Text variant="foot" style={{ flex: 1 }}>{t('auth.pin.tip')}</Text>
          </View>
        )}

        <Keypad onDigit={onDigit} onBackspace={onBackspace} disabled={isLoading} />

        <Button
          testID="create-pin-finish"
          label={t('auth.pin.finish')}
          onPress={() => finish(newPin, confirmPin)}
          disabled={!canFinish}
          loading={isLoading}
        />
      </View>
    </Screen>
  );
}

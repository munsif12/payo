import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Mic } from 'lucide-react-native';
import { Screen, Text, Button, Keypad, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, glassTokens } from '../../src/theme/tokens';
import { useRequestOtpMutation, apiErr } from '../../src/api/client';
import { otpRequested } from '../../src/store/authSlice';

const MAX_DIGITS = 10;

// GLASS-SPEC §5 B7: the 72 pt logo orb (Mic 32 navy, the orb glow) next to the
// "PAYO" wordmark, 28/800, letter-spacing 2, cream. Shared by the four sign-in
// screens; it never mirrors in Urdu (§6 rule 3).
const LOGO_ORB = 72;
const LOGO_ORB_ICON = 32;
const LOGO_ORB_HALO = Math.round(LOGO_ORB * glassTokens.orb.androidHaloScale);

export function BrandMark({ center }: { center?: boolean }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: center ? 'center' : 'flex-start' }}>
      <View style={{ width: LOGO_ORB, height: LOGO_ORB, alignItems: 'center', justifyContent: 'center' }}>
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: (LOGO_ORB - LOGO_ORB_HALO) / 2,
              left: (LOGO_ORB - LOGO_ORB_HALO) / 2,
              width: LOGO_ORB_HALO,
              height: LOGO_ORB_HALO,
              borderRadius: LOGO_ORB_HALO / 2,
              backgroundColor: glassTokens.orb.androidHalo,
            }}
          />
        ) : null}
        <View
          style={[
            {
              width: LOGO_ORB, height: LOGO_ORB, borderRadius: LOGO_ORB / 2, backgroundColor: c.amber,
              alignItems: 'center', justifyContent: 'center',
            },
            Platform.OS === 'ios' ? glassTokens.orb.glow : null,
          ]}
        >
          <Mic size={LOGO_ORB_ICON} color={c.onAmber} strokeWidth={2.4} />
        </View>
      </View>
      <Text weight={800} color={c.ink} style={{ fontSize: 28, lineHeight: 34, letterSpacing: 2, writingDirection: 'ltr' }}>
        {t('appName')}
      </Text>
    </View>
  );
}

// Groups a run of up to 10 digits as "300 111 0001" — Phone.dc.html.
function groupDigits(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
}

export default function Phone() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const dispatch = useDispatch();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const [digits, setDigits] = useState('');
  // An expired otpToken (enter-pin / create-pin bouncing back here) surfaces as an
  // inline message on first render; it clears as soon as the user starts typing.
  const [error, setError] = useState<string | null>(expired ? t('auth.otp.expired') : null);
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
      <View style={{ gap: space.l, paddingTop: space.xl }}>
        <BrandMark />

        <View>
          <Text variant="h1" style={{ fontSize: 32, lineHeight: urdu ? undefined : 38 }}>{t('auth.phone.title')}</Text>
          <Text variant="body" color={c.ink2} style={{ marginTop: 6 }}>{t('auth.phone.subtitle')}</Text>
        </View>

        {/* A phone number reads left-to-right regardless of UI language (Foundations.dc.html
            `.num`), so this field is deliberately NOT mirrored for Urdu/RTL. It is the only
            input on the screen, so it always wears the amber focus line (§2 Input). */}
        <View
          style={{
            height: 56, borderRadius: radius.input, backgroundColor: c.surface,
            borderWidth: glassTokens.inputFocusLine, borderColor: c.amber,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 12,
          }}
        >
          <View
            style={{
              height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.surface2,
              borderWidth: glassTokens.line, borderColor: c.separator, justifyContent: 'center',
            }}
          >
            <Text variant="sub" weight={700} color={c.ink} style={{ lineHeight: undefined, writingDirection: 'ltr', textAlign: 'left' }}>PK +92</Text>
          </View>
          <Text
            weight={600}
            color={digits ? c.ink : c.ink3}
            numberOfLines={1}
            style={{ flex: 1, fontSize: 28, lineHeight: 34, letterSpacing: 1, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'left' }}
            testID="phone-digits"
          >
            {digits ? groupDigits(digits) : '300 000 0000'}
          </Text>
        </View>

        {error ? (
          <View style={{ backgroundColor: c.redTint, borderRadius: radius.input, padding: 14 }}>
            <Text variant="sub" color={c.red} center>{error}</Text>
          </View>
        ) : null}

        <Keypad size={64} onDigit={onDigit} onBackspace={onBackspace} disabled={isLoading} />

        <Button
          testID="phone-submit"
          label={t('auth.phone.sendCode')}
          onPress={submit}
          disabled={digits.length !== MAX_DIGITS}
          loading={isLoading}
        />

        <Text variant="foot" color={c.ink3} center>{t('auth.phone.terms')}</Text>
      </View>
    </Screen>
  );
}

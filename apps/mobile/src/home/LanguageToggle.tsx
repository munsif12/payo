import React from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text, useIsUrdu } from '../ui';
import { useTheme } from '../theme/useTheme';
import { glassTokens, touch, type } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { applyLanguage } from '../i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SIZE = 44;

// The round glass language toggle in Home's head row (GLASS-SPEC §2 "Head row",
// B11/B28): «اردو» while the app is in English, «EN» while it is in Urdu. It
// goes through `applyLanguage` — the same entry point as More → Profile — so the
// choice is persisted exactly as it is there.
export function LanguageToggle() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const press = usePressScale();

  return (
    <AnimatedPressable
      testID="home-language-toggle"
      accessibilityRole="button"
      accessibilityLabel={t('home.language.toggle')}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        applyLanguage(urdu ? 'en' : 'ur');
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          minWidth: touch.min, minHeight: touch.min,
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          alignItems: 'center', justifyContent: 'center',
        },
        press.style,
      ]}
    >
      {urdu ? (
        <Text variant="sub" weight={700} color={c.ink} center style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.5 }}>
          EN
        </Text>
      ) : (
        // The Urdu word on an English screen: Text.tsx picks the Latin face from
        // the app language, so the Nastaliq face (with its own weight, see the
        // note in Text.tsx) is set here explicitly.
        <Text
          variant="sub"
          color={c.ink}
          center
          style={{
            fontFamily: type.urduFontFamily, fontWeight: undefined,
            fontSize: 14, lineHeight: 30, includeFontPadding: false,
          }}
        >
          اردو
        </Text>
      )}
    </AnimatedPressable>
  );
}

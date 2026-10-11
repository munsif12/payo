import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mic, Keyboard } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { glassTokens } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// AIBar — the "Ask PAYO — say or type…" pill, now in the glass vocabulary
// (GLASS-SPEC §2): `surface2` fill, the 1 px line, a 48 pt amber mic disc, ink
// text, a 40 pt glass keyboard disc. No shadow (§6 rule 2). Tapping anywhere
// navigates to Home (the assistant). The tabs layout no longer docks it —
// the nav orb replaced it (§4) — but it stays available to any screen.
export function AIBar({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      testID="ai-bar"
      accessibilityRole="button"
      accessibilityLabel={t('home.hint.askPayo')}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height: 60,
          borderRadius: 30,
          backgroundColor: c.surface2,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingLeft: 6,
          paddingRight: 8,
          gap: 12,
        },
        pressStyle,
        style,
      ]}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}>
        <Mic size={24} color={c.onAmber} strokeWidth={2.2} />
      </View>
      <Text variant="hl" weight={600} color={c.ink} style={{ flex: 1, opacity: 0.92 }} numberOfLines={1}>
        {t('home.hint.askPayo')}
      </Text>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center' }}>
        <Keyboard size={20} color={c.ink2} strokeWidth={2} />
      </View>
    </AnimatedPressable>
  );
}

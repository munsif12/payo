import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mic, Keyboard } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { usePressScale } from '../motion/usePressScale';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// AIBar — Main.dc.html / Wallet.dc.html .aiBar: navy pill docked above the
// tab bar on Wallet/Pay/More, 60pt tall, amber 48pt mic circle, "Ask PAYO —
// say or type…" label, 40pt keyboard affordance. Tapping anywhere navigates
// to Home (the assistant).
export function AIBar({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  // Light: navy bar + amber mic + white text/icons (Wallet.dc.html as drawn).
  // Dark: the navy bar would nearly disappear against the dark background,
  // so it swaps to the dark palette's surface2, with amber mic unchanged and
  // ink (not literal white) for text/icon contrast.
  const barBg = dark ? c.surface2 : c.navy;
  const textColor = dark ? c.ink : '#FFFFFF';
  const overlayBg = dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';

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
          backgroundColor: barBg,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingLeft: 6,
          paddingRight: 8,
          gap: 12,
          shadowColor: 'rgba(14,34,51,1)',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 30,
          elevation: 6,
        },
        pressStyle,
        style,
      ]}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}>
        <Mic size={24} color={c.navy} strokeWidth={2.2} />
      </View>
      <Text variant="hl" weight={600} color={textColor} style={{ flex: 1, opacity: 0.92 }} numberOfLines={1}>
        {t('home.hint.askPayo')}
      </Text>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: overlayBg, alignItems: 'center', justifyContent: 'center' }}>
        <Keyboard size={20} color={textColor} strokeWidth={2} />
      </View>
    </AnimatedPressable>
  );
}

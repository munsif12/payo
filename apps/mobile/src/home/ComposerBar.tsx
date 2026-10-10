import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Keyboard as KeyboardIcon, X } from 'lucide-react-native';
import { Text, useIsUrdu } from '../ui';
import { useTheme } from '../theme/useTheme';
import { glassTokens, space, touch } from '../theme/tokens';
import { IconSwap } from '../motion/IconSwap';
import { usePressScale } from '../motion/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** B3: a slim 56 pt glass bar, 6 pt inset, the 44 pt keyboard disc inside it. */
export const COMPOSER_BAR_HEIGHT = 56;
const INSET = 6;
const KEY = 44;

/**
 * The 44 pt round glass keyboard button (`composer-keyboard`): opens the typed
 * composer, and turns into ✕ while it is open. Shared by the greet hint row,
 * the listening pills and the conversation composer bar — exactly one of them
 * is on screen at a time, so the testID stays unique.
 */
export function KeyboardButton({ open, onPress, testID = 'composer-keyboard' }: {
  open: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const press = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('home.hint.askPayo')}
      accessibilityState={{ expanded: open }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          width: KEY, height: KEY, borderRadius: KEY / 2, minWidth: touch.min, minHeight: touch.min,
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          alignItems: 'center', justifyContent: 'center',
        },
        press.style,
      ]}
    >
      <IconSwap
        active={open}
        size={20}
        from={<KeyboardIcon size={20} color={c.ink2} strokeWidth={2} />}
        to={<X size={20} color={c.ink2} strokeWidth={2} />}
      />
    </AnimatedPressable>
  );
}

/**
 * The conversation state's composer bar (GLASS-SPEC §5 B3): a slim glass pill
 * above the nav with the keyboard button and the one-line hint. The mic lives
 * in the head row's mini orb, not here. Reads as a sentence, so it mirrors in
 * Urdu. testIDs are unchanged from the old voice bar (`voice-bar`,
 * `composer-keyboard`) so the QA scripts keep working.
 */
export function ComposerBar({ live, inputOpen, onKeyboard }: {
  live: boolean;
  inputOpen: boolean;
  onKeyboard: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();

  return (
    <View
      testID="voice-bar"
      style={{
        height: COMPOSER_BAR_HEIGHT,
        borderRadius: COMPOSER_BAR_HEIGHT / 2,
        backgroundColor: c.surface,
        borderWidth: glassTokens.line,
        borderColor: c.separator,
        paddingHorizontal: INSET,
        flexDirection: urdu ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: space.m,
      }}
    >
      <KeyboardButton open={inputOpen} onPress={onKeyboard} />
      <Text
        variant="sub"
        weight={600}
        color={c.ink2}
        numberOfLines={1}
        style={{ flex: 1, fontSize: 15, lineHeight: urdu ? undefined : 20 }}
      >
        {live ? t('home.voice.barLive') : t('home.voice.barIdle')}
      </Text>
    </View>
  );
}

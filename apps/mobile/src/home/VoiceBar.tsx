import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Keyboard as KeyboardIcon, Mic, X } from 'lucide-react-native';
import { Text } from '../ui';
import { useTheme } from '../theme/useTheme';
import { dark as onNavy, space, touch } from '../theme/tokens';
import { IconSwap, ListeningRings } from '../motion';
import { usePressScale } from '../motion/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Direction A artboard: a 64 pt navy pill, 6 pt inset, a 52 pt mic disc on the
 *  left, the hint in the middle, a 44 pt keyboard disc on the right. */
export const VOICE_BAR_HEIGHT = 64;
const INSET = 6;
const MIC = VOICE_BAR_HEIGHT - 2 * INSET;
const KEY = 44;

/**
 * The docked voice bar (v8). It replaces the floating mic + keyboard pair with
 * one object that reads as "talk to me": the amber mic starts the hands-free
 * loop, turns into a red ✕ while the conversation is live, and the hint says
 * what one tap does. The keyboard disc opens the typed composer above it.
 * testIDs are unchanged from the v7 FAB so the QA scripts keep working.
 */
export function VoiceBar({ live, listening, inputOpen, onMic, onKeyboard }: {
  live: boolean;
  listening: boolean;
  inputOpen: boolean;
  onMic: () => void;
  onKeyboard: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const mic = usePressScale();
  const key = usePressScale();

  return (
    <View
      testID="voice-bar"
      style={{
        height: VOICE_BAR_HEIGHT,
        borderRadius: VOICE_BAR_HEIGHT / 2,
        backgroundColor: c.navy,
        padding: INSET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        shadowColor: 'rgba(13,42,61,1)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 8,
      }}
    >
      <View style={{ width: MIC, height: MIC }}>
        {listening ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ListeningRings size={MIC} color={c.amber} />
          </View>
        ) : null}
        <AnimatedPressable
          testID={live ? 'composer-stop-listening' : 'composer-mic'}
          accessibilityRole="button"
          accessibilityLabel={live ? t('home.voice.hintLive') : t('home.hint.tap')}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onMic();
          }}
          onPressIn={mic.onPressIn}
          onPressOut={mic.onPressOut}
          style={[
            {
              width: MIC, height: MIC, borderRadius: MIC / 2,
              backgroundColor: live ? c.red : c.amber,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: live ? 'rgba(214,69,69,1)' : 'rgba(242,169,59,1)',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 6,
            },
            mic.style,
          ]}
        >
          <IconSwap
            active={live}
            size={26}
            from={<Mic size={26} color={c.navy} strokeWidth={2.4} />}
            to={<X size={24} color={c.white} strokeWidth={2.6} />}
          />
        </AnimatedPressable>
      </View>

      <Text
        variant="sub"
        weight={600}
        color={onNavy.ink}
        numberOfLines={1}
        style={{ flex: 1, fontSize: 15, lineHeight: 20 }}
      >
        {live ? t('home.voice.barLive') : t('home.voice.barIdle')}
      </Text>

      <AnimatedPressable
        testID="composer-keyboard"
        accessibilityRole="button"
        accessibilityLabel={t('home.hint.askPayo')}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onKeyboard();
        }}
        onPressIn={key.onPressIn}
        onPressOut={key.onPressOut}
        style={[
          {
            width: KEY, height: KEY, borderRadius: KEY / 2, minWidth: touch.min, minHeight: touch.min,
            backgroundColor: '#1E4A66', alignItems: 'center', justifyContent: 'center',
          },
          key.style,
        ]}
      >
        <IconSwap
          active={inputOpen}
          size={20}
          from={<KeyboardIcon size={20} color={onNavy.ink2} strokeWidth={2} />}
          to={<X size={20} color={onNavy.ink2} strokeWidth={2} />}
        />
      </AnimatedPressable>
    </View>
  );
}

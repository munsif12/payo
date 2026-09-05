import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/tokens';
import { Text, useIsUrdu } from './Text';
import { ListeningRings } from '../motion/ListeningRings';
import { TypingDots } from '../motion/TypingDots';
import { WaveBars } from '../motion/WaveBars';
import type { VoiceLoopMode } from '../voice/voiceLoopReducer';

const BAR_HEIGHT = 44;
const GLYPH_SIZE = 28;

export interface VoiceStatusBarProps {
  /** Only the four live modes render; `off` renders nothing. */
  mode: VoiceLoopMode;
  /** Tap while speaking — stops playback and re-opens the mic. */
  onInterrupt: () => void;
  style?: StyleProp<ViewStyle>;
}

// VoiceStatusBar — the 44pt row above the Composer while a hands-free
// conversation is live (v4 spec §2.5). It reuses the existing motion
// primitives (which already honour reduced motion) and only ever becomes a
// button in the `speaking` state, where tapping interrupts the assistant.
export function VoiceStatusBar({ mode, onInterrupt, style }: VoiceStatusBarProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();

  if (mode === 'off') return null;

  const speaking = mode === 'speaking';
  const label =
    mode === 'listening' ? t('home.voice.listening')
      : mode === 'thinking' ? t('home.voice.thinking')
        : speaking ? t('home.voice.speakingTap')
          : t('home.voice.paused');

  const glyph =
    mode === 'listening' ? <ListeningRings size={GLYPH_SIZE} color={c.amber} />
      : mode === 'thinking' ? <TypingDots color={c.ink3} />
        : speaking ? <WaveBars color={c.amber} />
          : null;

  const row = (
    <View
      style={{
        minHeight: BAR_HEIGHT,
        flexDirection: urdu ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
      }}
    >
      {glyph ? <View style={{ width: GLYPH_SIZE, height: GLYPH_SIZE, alignItems: 'center', justifyContent: 'center' }}>{glyph}</View> : null}
      <Text variant="sub" color={c.ink2}>{label}</Text>
    </View>
  );

  // The whole row is the tap target, but only while speaking — in every other
  // state it is a status readout, not a control, so it carries no button role.
  if (!speaking) return <View testID="voice-status-bar" style={style}>{row}</View>;

  return (
    <Pressable
      testID="voice-status-bar"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onInterrupt}
      style={style}
    >
      {row}
    </Pressable>
  );
}

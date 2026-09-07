import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Eye, EyeOff, Mic } from 'lucide-react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { dark as onNavy, space, touch } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { formatPaisa } from '../lib/money';
import { ltrIsolate } from '../lib/bidi';
import { useCountUp } from '../motion/useCountUp';
import { WordRise } from '../motion/WordRise';
import { Waveform } from '../motion/Waveform';
import { TypingDots } from '../motion/TypingDots';
import { Avatar } from './Avatar';
import { Text } from './Text';

/** Artboard: `padding:56px 20px 0`. 56 pt from the top of the device, i.e. the
 *  status bar plus a little — measured off the safe area so it holds on every phone. */
const HEAD_PADDING_ABOVE_INSET = 10;
const HEAD_GAP = 14;
const AVATAR_SIZE = 36;
/** Greeting: 26/800, line-height 1.15, letter-spacing -.01em. */
const GREETING_SIZE = 26;
const GREETING_LINE_HEIGHT = 30;
const GREETING_LETTER_SPACING = -0.26;
const BALANCE_SIZE = 22;
const STATUS_SIZE = 14;
const STATUS_ROW_HEIGHT = 24;

export type NavyHeadStatus = 'none' | 'listening' | 'thinking' | 'speaking' | 'paused';

export interface NavyHeadProps {
  /** The account holder — avatar initials plus the name line. */
  name: string;
  /** "Good morning" / "صبح بخیر". */
  greetingFoot: string;
  /** The assistant's opening line — arrives word by word on first paint. */
  greeting: string;
  /** Omit (or pass null) to drop the balance line entirely — the conversation head. */
  balancePaisa?: number | null;
  balanceRevealed?: boolean;
  onToggleBalance?: () => void;
  /** The assistant's live state. `none` renders no status row. */
  status?: NavyHeadStatus;
  /** useRecorder's shared mic level (0…1) — drives the listening waveform on the
   *  UI thread. Omitted on screens with no recorder: the bars sit at rest. */
  level?: SharedValue<number>;
  /** Tapping the row while speaking interrupts the assistant. */
  onStatusPress?: () => void;
  /** From `HEAD_HEIGHT` in src/home/homeState.ts (316 / 350 / 230). */
  height: number;
  urdu?: boolean;
  /** First paint only: the greeting words rise. Pass `useFirstPaint()`. */
  animateGreeting?: boolean;
  /** Delay before the first greeting word. */
  greetingOffset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// NavyHead — the navy head every "money" screen wears (spec §1 rule 3, §4).
// It carries the avatar row, the greeting, the balance line and the assistant's
// live status. Height is driven by the caller (316 greet / 350 listening / 230
// conversation) and changes instantly: spec §3 forbids animating layout.
export function NavyHead({
  name, greetingFoot, greeting,
  balancePaisa, balanceRevealed = true, onToggleBalance,
  status = 'none', level, onStatusPress,
  height, urdu = false, animateGreeting = false, greetingOffset = 0,
  style, testID,
}: NavyHeadProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const countedPaisa = useCountUp(balancePaisa ?? 0);
  // A head without a recorder behind it (Wallet, Pockets) still has to give the
  // Waveform something to read.
  const restingLevel = useSharedValue(0);

  const row: ViewStyle = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' };
  const amount = formatPaisa(countedPaisa);

  return (
    <View
      testID={testID}
      style={[
        {
          height,
          backgroundColor: c.navy,
          paddingTop: insets.top + HEAD_PADDING_ABOVE_INSET,
          paddingHorizontal: space.gutter,
          gap: HEAD_GAP,
        },
        style,
      ]}
    >
      <View style={[row, { gap: 10 }]}>
        <Avatar name={name || 'PAYO'} size={AVATAR_SIZE} />
        <View>
          <Text variant="foot" color={onNavy.ink2} style={{ fontSize: 12, lineHeight: urdu ? undefined : 16 }}>
            {greetingFoot}
          </Text>
          <Text variant="hl" weight={700} color={onNavy.ink} style={{ fontSize: 15, lineHeight: urdu ? undefined : 20 }}>
            {name}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {/* Decorative, per the artboard: notifications live on their own screen. */}
        <Bell size={20} color={onNavy.ink2} strokeWidth={2} />
      </View>

      <WordRise
        testID="home-greeting"
        text={greeting}
        animate={animateGreeting}
        offset={greetingOffset}
        urdu={urdu}
        textStyle={
          urdu
            ? { fontSize: GREETING_SIZE, color: onNavy.ink }
            : {
              fontSize: GREETING_SIZE,
              lineHeight: GREETING_LINE_HEIGHT,
              letterSpacing: GREETING_LETTER_SPACING,
              color: onNavy.ink,
            }
        }
      />

      {balancePaisa != null ? (
        <Pressable
          testID="home-balance-pill"
          accessibilityRole="button"
          accessibilityLabel={t('home.balance')}
          onPress={onToggleBalance}
          hitSlop={8}
          style={[row, { alignItems: 'baseline', gap: space.s }]}
        >
          <Text
            variant="money"
            color={onNavy.ink}
            weight={800}
            style={{ fontSize: BALANCE_SIZE, lineHeight: BALANCE_SIZE + 6, letterSpacing: undefined }}
          >
            {balanceRevealed ? (urdu ? ltrIsolate(amount) : amount) : '₨ ••••••'}
          </Text>
          <Text variant="foot" color={onNavy.ink2} style={{ fontSize: 12, lineHeight: urdu ? undefined : 16 }}>
            {t('home.balance')}
          </Text>
          {balanceRevealed
            ? <EyeOff size={14} color={onNavy.ink2} strokeWidth={2} />
            : <Eye size={14} color={onNavy.ink2} strokeWidth={2} />}
        </Pressable>
      ) : null}

      {status !== 'none' ? (
        <StatusRow status={status} level={level ?? restingLevel} urdu={urdu} onPress={onStatusPress} />
      ) : null}
    </View>
  );
}

function StatusRow({ status, level, urdu, onPress }: {
  status: Exclude<NavyHeadStatus, 'none'>;
  level: SharedValue<number>;
  urdu: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const label =
    status === 'listening' ? t('home.voice.listening')
      : status === 'thinking' ? t('home.voice.thinking')
        : status === 'speaking' ? t('home.voice.speakingTap')
          : t('home.voice.paused');

  const glyph =
    status === 'listening' ? <Waveform level={level} color={c.amber} />
      : status === 'thinking' ? <TypingDots color={onNavy.ink2} />
        : status === 'speaking' ? <Mic size={16} color={c.amber} strokeWidth={2} />
          : null;

  const row = (
    <View
      style={{
        flexDirection: urdu ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: space.m,
        minHeight: STATUS_ROW_HEIGHT,
      }}
    >
      {glyph}
      <Text
        variant="sub"
        weight={600}
        color={onNavy.ink}
        style={{ fontSize: STATUS_SIZE, lineHeight: urdu ? undefined : 20 }}
      >
        {label}
      </Text>
    </View>
  );

  // Only "Speaking… tap to interrupt" is a control; every other state is a
  // readout, so it carries no button role.
  if (status !== 'speaking' || !onPress) return <View testID="voice-status-bar">{row}</View>;

  // The row is 24 pt so the head keeps the artboard's rhythm; hitSlop takes the
  // TAP target past the 44 pt minimum without moving anything.
  const slop = (touch.min - STATUS_ROW_HEIGHT) / 2;
  return (
    <Pressable
      testID="voice-status-bar"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: space.gutter, right: space.gutter }}
    >
      {row}
    </Pressable>
  );
}

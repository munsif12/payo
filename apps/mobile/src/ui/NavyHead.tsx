import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Eye, EyeOff } from 'lucide-react-native';
import type { SharedValue } from 'react-native-reanimated';
import { space, touch } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { formatPaisa } from '../lib/money';
import { ltrIsolate } from '../lib/bidi';
import { useCountUp } from '../motion/useCountUp';
import { WordRise } from '../motion/WordRise';
import { Avatar } from './Avatar';
import { Text } from './Text';

/** Artboard: 56 pt from the top of the device, i.e. the status bar plus a
 *  little — measured off the safe area so it holds on every phone. */
const HEAD_PADDING_ABOVE_INSET = 10;
/** GLASS-SPEC §2 "Head row": 40 pt avatar · name 17/700 · sub-line 14 ink2 · right slot. */
const AVATAR_SIZE = 40;
const ROW_GAP = 12;
const NAME_SIZE = 17;
const NAME_LINE_HEIGHT = 22;
const SUBLINE_SIZE = 14;
const SUBLINE_LINE_HEIGHT = 20;
/** §5 Home greet: the greeting is 34/800, centred. Urdu: Nastaliq, no forced
 *  line height (Text.tsx keeps the Nastaliq minimum as long as none is passed). */
const GREETING_SIZE = 34;
const GREETING_LINE_HEIGHT = 40;
const GREETING_LETTER_SPACING = -0.34;
/** B11: the greeting floats well clear of the head row. */
const GREETING_GAP = 32;

export type NavyHeadStatus = 'none' | 'listening' | 'thinking' | 'speaking' | 'paused';

export interface NavyHeadProps {
  /** The account holder — avatar initials plus the name line. */
  name: string;
  /** The sub-line under the name when there is neither a balance nor a live
   *  status to show — "Available balance" on Wallet, the time-of-day greeting
   *  on a Home face with the loop off and no balance. */
  greetingFoot: string;
  /** The big line under the head row — arrives word by word on first paint.
   *  Omit it for the compact head (Home listening / conversation). */
  greeting?: string;
  /** When set, the sub-line is "Rs 84,500 available" and tapping it toggles the
   *  reveal (B11). Omit (or pass null) to drop it — Wallet draws its own balance. */
  balancePaisa?: number | null;
  balanceRevealed?: boolean;
  onToggleBalance?: () => void;
  /** The assistant's live state. Anything but `none` takes over the sub-line
   *  ("Listening…", "Speaking… tap to interrupt"). */
  status?: NavyHeadStatus;
  /** Kept for API compatibility — the head no longer draws the waveform; Home's
   *  listening body does. */
  level?: SharedValue<number>;
  /** Tapping the sub-line while speaking interrupts the assistant. */
  onStatusPress?: () => void;
  /** A fixed height. Omit it and the head sizes to its content (the Home faces). */
  height?: number;
  urdu?: boolean;
  /** First paint only: the greeting words rise. Pass `useFirstPaint()`. */
  animateGreeting?: boolean;
  /** Delay before the first greeting word. */
  greetingOffset?: number;
  /** GLASS-SPEC §2 "Head row": what sits at the trailing end of the avatar row —
   *  the 56 pt mini orb on money screens, the round language toggle on Home.
   *  Omitted: the decorative bell, as before. */
  rightSlot?: React.ReactNode;
  /** `center` centres the greeting (the Home greet state, B11). The head row
   *  stays edge-to-edge. Default `left`. */
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// NavyHead — the head every "money" screen wears. Under Direction B
// (GLASS-SPEC §1) it is transparent: the gradient behind the screen is the
// ground, so the head carries no fill of its own. It holds the head row
// (avatar · name · sub-line · right slot) and, when given one, the greeting.
// The sub-line is one of three things, in priority order: the assistant's live
// status, the tappable balance, or `greetingFoot`. Height is the content's own
// unless the caller fixes it; either way it changes instantly — the motion
// spec forbids animating layout.
export function NavyHead({
  name, greetingFoot, greeting,
  balancePaisa, balanceRevealed = true, onToggleBalance,
  status = 'none', onStatusPress,
  height, urdu = false, animateGreeting = false, greetingOffset = 0,
  rightSlot, align = 'left',
  style, testID,
}: NavyHeadProps) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const countedPaisa = useCountUp(balancePaisa ?? 0);

  const centered = align === 'center';
  const row: ViewStyle = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' };
  const sublineStyle = { fontSize: SUBLINE_SIZE, lineHeight: urdu ? undefined : SUBLINE_LINE_HEIGHT };

  let subline: React.ReactNode;
  if (status !== 'none') {
    subline = <StatusLine status={status} onPress={onStatusPress} textStyle={sublineStyle} />;
  } else if (balancePaisa != null) {
    const amount = formatPaisa(countedPaisa);
    subline = (
      <Pressable
        testID="home-balance-pill"
        accessibilityRole="button"
        accessibilityLabel={t('home.balance')}
        onPress={onToggleBalance}
        hitSlop={8}
        style={[row, { gap: 6 }]}
      >
        <Text variant="sub" color={c.ink2} style={sublineStyle}>
          {t('home.head.available', {
            amount: balanceRevealed ? (urdu ? ltrIsolate(amount) : amount) : '₨ ••••••',
          })}
        </Text>
        {balanceRevealed
          ? <EyeOff size={14} color={c.ink2} strokeWidth={2} />
          : <Eye size={14} color={c.ink2} strokeWidth={2} />}
      </Pressable>
    );
  } else {
    subline = <Text variant="sub" color={c.ink2} style={sublineStyle}>{greetingFoot}</Text>;
  }

  return (
    <View
      testID={testID}
      style={[
        {
          height,
          backgroundColor: 'transparent',
          paddingTop: insets.top + HEAD_PADDING_ABOVE_INSET,
          paddingHorizontal: space.gutter,
        },
        style,
      ]}
    >
      <View style={[row, { gap: ROW_GAP }]}>
        <Avatar name={name || 'PAYO'} size={AVATAR_SIZE} />
        <View style={{ flex: 1, alignItems: urdu ? 'flex-end' : 'flex-start' }}>
          <Text
            variant="hl"
            weight={700}
            color={c.ink}
            numberOfLines={1}
            style={{ fontSize: NAME_SIZE, lineHeight: urdu ? undefined : NAME_LINE_HEIGHT }}
          >
            {name}
          </Text>
          {subline}
        </View>
        {rightSlot !== undefined
          ? rightSlot
          // Decorative, per the artboard: notifications live on their own screen.
          : <Bell size={20} color={c.ink2} strokeWidth={2} />}
      </View>

      {greeting ? (
        <WordRise
          testID="home-greeting"
          text={greeting}
          animate={animateGreeting}
          offset={greetingOffset}
          urdu={urdu}
          style={[{ marginTop: GREETING_GAP }, centered ? { justifyContent: 'center' } : null]}
          textStyle={[
            urdu
              ? { fontSize: GREETING_SIZE, color: c.ink }
              : {
                fontSize: GREETING_SIZE,
                lineHeight: GREETING_LINE_HEIGHT,
                letterSpacing: GREETING_LETTER_SPACING,
                color: c.ink,
              },
            centered ? { textAlign: 'center' } : null,
          ]}
        />
      ) : null}
    </View>
  );
}

/** The live status as the head's sub-line (B2 "Listening…", B3 "Speaking… tap
 *  to interrupt"). Only the speaking line is a control; every other state is a
 *  readout, so it carries no button role. */
function StatusLine({ status, onPress, textStyle }: {
  status: Exclude<NavyHeadStatus, 'none'>;
  onPress?: () => void;
  textStyle: { fontSize: number; lineHeight: number | undefined };
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const label =
    status === 'listening' ? t('home.voice.listening')
      : status === 'thinking' ? t('home.voice.thinking')
        : status === 'speaking' ? t('home.voice.speakingTap')
          : t('home.voice.paused');

  const text = <Text variant="sub" color={c.ink2} style={textStyle}>{label}</Text>;

  if (status !== 'speaking' || !onPress) return <View testID="voice-status-bar">{text}</View>;

  // The line is 20 pt so the head keeps the artboard's rhythm; hitSlop takes the
  // TAP target past the 44 pt minimum without moving anything.
  const slop = (touch.min - SUBLINE_LINE_HEIGHT) / 2;
  return (
    <Pressable
      testID="voice-status-bar"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: space.gutter, right: space.gutter }}
    >
      {text}
    </Pressable>
  );
}

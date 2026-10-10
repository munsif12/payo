import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AudioLines, Mic } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { glassTokens } from '../theme/tokens';
import { IconSwap } from '../motion/IconSwap';
import { ListeningRings } from '../motion/ListeningRings';
import { usePressScale } from '../motion/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { orb: ORB } = glassTokens;

const HERO_ICON = 44;
const MINI_ICON = 24;

export interface OrbProps {
  /** True while the mic is open: `AudioLines` replaces `Mic` (and the hero grows rings). */
  listening: boolean;
  onPress: () => void;
  /** B2 footnote: "hold to end". */
  onLongPress?: () => void;
  /** Accessibility label — what one tap does right now. */
  label: string;
  testID: string;
}

interface InnerProps extends OrbProps {
  size: number;
  iconSize: number;
  /** The hero shows `ListeningRings` around itself while listening. */
  rings: boolean;
}

// The voice orb — GLASS-SPEC §3. One amber circle in two sizes: the 120 pt hero
// on Home (greet + listening) and the 56 pt mini orb in a head row. Both carry
// the amber glow (the iOS shadow; Android gets the translucent amber disc behind
// it instead, since it has no coloured shadows) and swap `Mic` for `AudioLines`
// while the mic is open. What a press does is the caller's — on Home it is
// always `live ? stop : start`.
function Orb({ size, iconSize, rings, listening, onPress, onLongPress, label, testID }: InnerProps) {
  const { c } = useTheme();
  const press = usePressScale();
  const halo = Math.round(size * ORB.androidHaloScale);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Platform.OS === 'android' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: halo, height: halo, borderRadius: halo / 2,
            backgroundColor: ORB.androidHalo,
          }}
        />
      ) : null}
      {rings && listening ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ListeningRings size={size} color={c.amber} />
        </View>
      ) : null}
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onLongPress={onLongPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          {
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: c.amber,
            alignItems: 'center', justifyContent: 'center',
          },
          Platform.OS === 'ios' ? ORB.glow : null,
          press.style,
        ]}
      >
        <IconSwap
          active={listening}
          size={iconSize}
          from={<Mic size={iconSize} color={c.onAmber} strokeWidth={2.4} />}
          to={<AudioLines size={iconSize} color={c.onAmber} strokeWidth={2.4} />}
        />
      </AnimatedPressable>
    </View>
  );
}

/** §3 hero orb: 120 pt, `Mic` 44 → `AudioLines` 44 with `ListeningRings`. */
export function HeroOrb(props: OrbProps) {
  return <Orb size={ORB.hero} iconSize={HERO_ICON} rings {...props} />;
}

/** §3 mini orb: 56 pt, in a head row's right slot. */
export function MiniOrb(props: OrbProps) {
  return <Orb size={ORB.mini} iconSize={MINI_ICON} rings={false} {...props} />;
}

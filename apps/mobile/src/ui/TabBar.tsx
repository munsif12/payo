import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Wallet, Send, Ellipsis, Mic, AudioLines, type LucideIcon } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { glassTokens } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import { IconSwap } from '../motion/IconSwap';
import { useOrbState } from '../voice/orbBus';
import { Text, useIsUrdu } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TabKey = 'home' | 'wallet' | 'pay' | 'more';

const { nav: NAV, orb: ORB, line: LINE } = glassTokens;

/** What the nav occupies above the safe-area inset: the raised orb's overhang,
 *  the pill, and the pill's bottom margin. The pill is in normal flow (the tab
 *  navigator lays the scene out above it), so most screens never need this —
 *  it is for content that deliberately runs under the bar. */
export const NAV_BAR_CLEARANCE = ORB.navRaise + NAV.height + NAV.marginBottom;

interface Item { key: TabKey; icon: LucideIcon; labelKey: string }
const LEADING: Item[] = [
  { key: 'home', icon: House, labelKey: 'tabs.home' },
  { key: 'wallet', icon: Wallet, labelKey: 'tabs.wallet' },
];
const TRAILING: Item[] = [
  { key: 'pay', icon: Send, labelKey: 'tabs.pay' },
  { key: 'more', icon: Ellipsis, labelKey: 'tabs.more' },
];
const PILL_PADDING_H = 8;
const ORB_ICON = 26;
/** Android's stand-in for the coloured shadow: a translucent amber disc. */
const ORB_HALO = Math.round(ORB.nav * ORB.androidHaloScale);

export interface TabBarProps {
  active: TabKey;
  onPress: (key: TabKey) => void;
  /** The orb was tapped. The tabs layout wires this to `orbBus.press()` and,
   *  when nothing handled it (or Home is not the active tab), to the Home tab. */
  onOrbPress?: () => void;
}

// TabBar — GLASS-SPEC §4, NAV option 1: a floating glass pill in normal flow
// (16 pt side margins, `insets.bottom + 8` below, 72 tall, radius 36, the
// navy-tinted glass fill and the 1 px line) with five slots: Home · Wallet ·
// orb · Pay · More. The active item is amber over a 56 pt `amberTint` circle;
// the rest are ink2. The amber orb (60 pt, Mic → AudioLines while listening)
// rides 10 pt above the pill with the amber glow. In Urdu the labels row is
// `row-reverse` (Home on the right); the orb stays in the centre and never
// mirrors. testIDs: `tab-home|wallet|pay|more`, `nav-orb`.
export function TabBar({ active, onPress, onOrbPress }: TabBarProps) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const insets = useSafeAreaInsets();
  const orbState = useOrbState();
  const orb = usePressScale();
  const listening = orbState === 'listening';

  return (
    <View
      testID="nav-bar"
      style={{
        paddingTop: ORB.navRaise,
        paddingHorizontal: NAV.marginH,
        paddingBottom: insets.bottom + NAV.marginBottom,
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          height: NAV.height,
          borderRadius: NAV.radius,
          backgroundColor: NAV.fill,
          borderWidth: LINE,
          borderColor: c.separator,
          flexDirection: urdu ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: PILL_PADDING_H,
        }}
      >
        {LEADING.map((item) => (
          <TabItem key={item.key} item={item} active={item.key === active} onPress={onPress} />
        ))}
        {/* The orb's slot in the row — the orb itself floats over it, below. */}
        <View style={{ flex: 1 }} />
        {TRAILING.map((item) => (
          <TabItem key={item.key} item={item} active={item.key === active} onPress={onPress} />
        ))}
      </View>

      {/* The orb, centred and raised: its top edge sits `navRaise` above the
          pill (the container's top padding is exactly that overhang). The glow
          is the iOS shadow; Android gets the translucent disc behind it. */}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
        {Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: (ORB.nav - ORB_HALO) / 2,
              width: ORB_HALO,
              height: ORB_HALO,
              borderRadius: ORB_HALO / 2,
              backgroundColor: ORB.androidHalo,
            }}
          />
        ) : null}
        <AnimatedPressable
          testID="nav-orb"
          accessibilityRole="button"
          accessibilityLabel={t('home.hint.askPayo')}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onOrbPress?.();
          }}
          onPressIn={orb.onPressIn}
          onPressOut={orb.onPressOut}
          style={[
            {
              width: ORB.nav,
              height: ORB.nav,
              borderRadius: ORB.nav / 2,
              backgroundColor: c.amber,
              alignItems: 'center',
              justifyContent: 'center',
            },
            Platform.OS === 'ios' ? ORB.glow : null,
            orb.style,
          ]}
        >
          <IconSwap
            active={listening}
            size={ORB_ICON}
            from={<Mic size={ORB_ICON} color={c.onAmber} strokeWidth={2.4} />}
            to={<AudioLines size={ORB_ICON} color={c.onAmber} strokeWidth={2.4} />}
          />
        </AnimatedPressable>
      </View>
    </View>
  );
}

function TabItem({ item, active, onPress }: { item: Item; active: boolean; onPress: (key: TabKey) => void }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const Icon = item.icon;
  const color = active ? c.amber : c.ink2;

  return (
    <Pressable
      testID={`tab-${item.key}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress(item.key);
      }}
      style={{ flex: 1, height: NAV.height, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          minWidth: NAV.activeHalo,
          height: NAV.activeHalo,
          borderRadius: NAV.activeHalo / 2,
          paddingHorizontal: 6,
          backgroundColor: active ? c.amberTint : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Icon size={NAV.icon} color={color} strokeWidth={active ? 2.2 : 2} />
        <Text
          variant="cap"
          weight={600}
          color={color}
          numberOfLines={1}
          style={{ textTransform: 'none', letterSpacing: undefined, fontSize: NAV.label, lineHeight: urdu ? undefined : 14 }}
        >
          {t(item.labelKey)}
        </Text>
      </View>
    </Pressable>
  );
}

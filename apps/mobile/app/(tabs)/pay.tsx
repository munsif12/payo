import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownLeft, AudioLines, Mic, PiggyBank, QrCode, Search, Send, Smartphone, Zap, type LucideIcon,
} from 'lucide-react-native';
import { Text, Input, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, glassTokens } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion';
import { useMeQuery } from '../../src/api/client';
import { useFamily } from '../../src/home/useFamily';
import { orbBus, useOrbState } from '../../src/voice/orbBus';
import type { RecipientDto } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { orb: ORB, line: LINE } = glassTokens;

/** GLASS-SPEC §2 "Head row": 40 pt avatar, name 17/700, sub-line 14 ink2. */
const HEAD_AVATAR = 40;
const HEAD_PADDING_ABOVE_INSET = 10;
/** B6: "What would you like to pay?" at 32/800. */
const TITLE_SIZE = 32;
const TITLE_LINE_HEIGHT = 38;
/** B6 tile: a 56 pt `amberTint` square (radius 16) holding a 24 pt amber icon. */
const TILE_ICON_BOX = 56;
const TILE_ICON_RADIUS = 16;
const TILE_ICON = 24;
/** B6 family chip: a 48 pt glass pill with a 32 pt cream avatar. */
const CHIP_HEIGHT = 48;
const CHIP_AVATAR = 32;
const ORB_ICON = 24;
const ORB_HALO = Math.round(ORB.mini * ORB.androidHaloScale);

type TileHref = string | { pathname: string; params: Record<string, string> };

/** The 2×3 grid, reading order. testIDs stay `pay-tile-<key>`. */
const TILES: { key: string; titleKey: string; subKey: string; icon: LucideIcon; href: TileHref }[] = [
  { key: 'send', titleKey: 'pay.tile.send', subKey: 'pay.tile.sendSub', icon: Send, href: '/send' },
  { key: 'bills', titleKey: 'pay.tile.bill', subKey: 'pay.tile.billSub', icon: Zap, href: '/bills' },
  { key: 'recharge', titleKey: 'pay.tile.topup', subKey: 'pay.tile.topupSub', icon: Smartphone, href: '/recharge' },
  { key: 'qr', titleKey: 'pay.tile.qr', subKey: 'pay.tile.qrSub', icon: QrCode, href: { pathname: '/qr', params: { tab: 'scan' } } },
  { key: 'requests', titleKey: 'pay.tile.request', subKey: 'pay.tile.requestSub', icon: ArrowDownLeft, href: '/requests' },
  { key: 'pockets', titleKey: 'pay.tile.pockets', subKey: 'pay.tile.pocketsSub', icon: PiggyBank, href: '/pockets' },
];
const TILE_ROWS = [TILES.slice(0, 2), TILES.slice(2, 4), TILES.slice(4, 6)];

// Pay hub — GLASS-SPEC §5 B6. Head row + mini orb, the question, a glass search
// field, 2×3 glass tiles with amber icon squares, and the FAMILY row of glass
// chips (cream avatars) built from the same recipients Home shows. The tabs
// layout paints the gradient; this screen is transparent.
export default function PayHub() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMeQuery();
  const family = useFamily();
  const [query, setQuery] = useState('');

  const name = (urdu && me?.user.urduName ? me.user.urduName : me?.user.name) || t('pay.title');

  const onSearchSubmit = () => {
    if (!query.trim()) return;
    router.push({ pathname: '/send', params: { q: query.trim() } });
  };

  // The mini orb (§3) — see Wallet: never on Home here, so always go there.
  const onOrbPress = () => {
    orbBus.press();
    router.push('/(tabs)');
  };

  // A family chip opens the send flow for that person exactly as the saved-recipient
  // rows on /send do (goAmountForRecipient): straight to the amount step.
  const onFamily = (r: RecipientDto) =>
    router.push({
      pathname: '/send/amount',
      params: {
        recipientId: r.id,
        title: r.title,
        institutionName: urdu && r.institution.urduName ? r.institution.urduName : r.institution.name,
        identifier: r.identifier,
      },
    });

  const row = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + HEAD_PADDING_ABOVE_INSET,
          paddingHorizontal: space.gutter,
          paddingBottom: space.xl,
          gap: space.l,
        }}
      >
        <View testID="pay-head" style={[row, { gap: space.m }]}>
          <Avatar name={me?.user.name || 'PAYO'} size={HEAD_AVATAR} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="hl" weight={700} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 22 }}>
              {name}
            </Text>
            <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
              {t('pay.headSub')}
            </Text>
          </View>
          <MiniOrb testID="pay-orb" onPress={onOrbPress} />
        </View>

        <Text variant="h1" weight={800} color={c.ink} style={{ fontSize: TITLE_SIZE, lineHeight: urdu ? undefined : TITLE_LINE_HEIGHT }}>
          {t('pay.question')}
        </Text>

        <Input
          testID="pay-search"
          icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
          placeholder={t('pay.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />

        <View style={{ gap: space.m }}>
          {TILE_ROWS.map((tiles, i) => (
            <View key={i} style={[row, { gap: space.m, alignItems: 'stretch' }]}>
              {tiles.map(({ key, titleKey, subKey, icon: Icon, href }) => (
                <Tile
                  key={key}
                  testID={`pay-tile-${key}`}
                  icon={Icon}
                  title={t(titleKey)}
                  sub={t(subKey)}
                  onPress={() => router.push(href as Parameters<typeof router.push>[0])}
                />
              ))}
            </View>
          ))}
        </View>

        {family.length > 0 ? (
          <View testID="pay-family" style={[row, { gap: space.m, flexWrap: 'wrap' }]}>
            <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{t('pay.family')}</Text>
            {family.map((p) => (
              <FamilyChip
                key={p.id}
                testID={`pay-family-${p.nickname}`}
                nickname={p.nickname}
                // In Urdu a PAYO-linked person is named the way the user says it (بلال).
                label={urdu ? (p.urduNickname || p.urduTitle || p.nickname) : p.nickname}
                onPress={() => onFamily(p)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** One glass tile: icon square, title 20/700, sub 15 ink2. */
function Tile({ testID, icon: Icon, title, sub, onPress }: {
  testID: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const press = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          flex: 1, borderRadius: radius.card, padding: space.xl, gap: space.l,
          backgroundColor: c.surface, borderWidth: LINE, borderColor: c.separator,
          alignItems: urdu ? 'flex-end' : 'flex-start',
        },
        press.style,
      ]}
    >
      <View style={{ width: TILE_ICON_BOX, height: TILE_ICON_BOX, borderRadius: TILE_ICON_RADIUS, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={TILE_ICON} color={c.amber} strokeWidth={2.2} />
      </View>
      <View style={{ gap: space.xs, alignSelf: 'stretch' }}>
        <Text variant="h2" weight={700} color={c.ink} style={{ fontSize: 20, lineHeight: urdu ? undefined : 26 }}>{title}</Text>
        <Text variant="sub" color={c.ink2} numberOfLines={2}>{sub}</Text>
      </View>
    </AnimatedPressable>
  );
}

/** A FAMILY chip: glass pill, cream avatar with navy initials, name 17/600. */
function FamilyChip({ testID, nickname, label, onPress }: {
  testID: string;
  nickname: string;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const press = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          height: CHIP_HEIGHT, borderRadius: CHIP_HEIGHT / 2, paddingHorizontal: space.s,
          backgroundColor: c.surface, borderWidth: LINE, borderColor: c.separator,
          flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.s,
        },
        press.style,
      ]}
    >
      <Avatar name={nickname} size={CHIP_AVATAR} bg={c.cream} color={c.navy} />
      <Text variant="hl" weight={600} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 22, paddingHorizontal: space.xs }}>{label}</Text>
    </AnimatedPressable>
  );
}

/** The 56 pt amber mini orb (GLASS-SPEC §3) in the head row's right slot. */
function MiniOrb({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const listening = useOrbState() === 'listening';
  const press = usePressScale();
  return (
    <View style={{ width: ORB.mini, height: ORB.mini, alignItems: 'center', justifyContent: 'center' }}>
      {Platform.OS === 'android' ? (
        <View pointerEvents="none" style={{ position: 'absolute', width: ORB_HALO, height: ORB_HALO, borderRadius: ORB_HALO / 2, backgroundColor: ORB.androidHalo }} />
      ) : null}
      <AnimatedPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t('home.hint.askPayo')}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          { width: ORB.mini, height: ORB.mini, borderRadius: ORB.mini / 2, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' },
          Platform.OS === 'ios' ? ORB.glow : null,
          press.style,
        ]}
      >
        {listening
          ? <AudioLines size={ORB_ICON} color={c.onAmber} strokeWidth={2.4} />
          : <Mic size={ORB_ICON} color={c.onAmber} strokeWidth={2.4} />}
      </AnimatedPressable>
    </View>
  );
}

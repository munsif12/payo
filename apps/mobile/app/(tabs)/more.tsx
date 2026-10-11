import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
  PiggyBank, CreditCard, FileText, ArrowDownLeft, Languages, Shield, Bell, LifeBuoy, LogOut,
  ChevronLeft, ChevronRight, Settings as SettingsIcon, type LucideIcon,
} from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, Text, Card, ListRow, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion';
import { signedOut } from '../../src/store/authSlice';
import { useMeQuery, usePocketsQuery, useRequestsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import { formatPhone } from '../../src/lib/mask';
import i18n from '../../src/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** B13: "More" at 36/800. */
const TITLE_SIZE = 36;
const TITLE_LINE_HEIGHT = 42;
/** B13 profile card: a 72 pt cream avatar. */
const PROFILE_AVATAR = 72;
/** B13 rows: a 56 pt `amberTint` square (radius 16) holding a 24 pt amber icon. */
const ICON_BOX = 56;
const ICON_BOX_RADIUS = 16;
const ICON = 24;

// More — GLASS-SPEC §5 B13. The profile glass card, then the MONEY and ACCOUNT
// groups as one glass card each: rows with amber icon squares, glass
// separators and chevrons. Every route and the language switch (More →
// Profile) are exactly as before; only the skin changed. Log out and the
// version line stay below the two groups.
export default function More() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: me } = useMeQuery();
  const { data: pockets } = usePocketsQuery();
  const { data: requests } = useRequestsQuery();

  const user = me?.user;
  const name = urdu && user?.urduName ? user.urduName : user?.name ?? '';
  const totalPocketPaisa = (pockets?.items ?? []).reduce((sum, p) => sum + p.balancePaisa, 0);
  const pendingRequests = (requests?.items ?? []).filter((r) => r.status === 'pending' && r.direction === 'incoming').length;
  const languageLabel = i18n.language === 'ur' ? t('profile.urdu') : t('profile.english');

  const sub = (text: string) => (
    <Text variant="sub" color={c.ink2} numberOfLines={1}>{text}</Text>
  );
  const chevron = <Chevron />;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: space.l, gap: space.l, paddingBottom: space.xl }}>
        <Text variant="h1" weight={800} color={c.ink} style={{ fontSize: TITLE_SIZE, lineHeight: urdu ? undefined : TITLE_LINE_HEIGHT }}>
          {t('more.title')}
        </Text>

        <ProfileCard
          testID="more-profile-header"
          latinName={user?.name ?? ''}
          name={name}
          sub={t('more.profileSub', { phone: ltrIsolate(formatPhone(user?.phone ?? '')) })}
          onPress={() => router.push('/profile')}
        />

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('more.money')}</SectionLabel>
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="more-pockets"
              onPress={() => router.push('/pockets')}
              left={<IconSquare icon={PiggyBank} />}
              title={t('more.pockets')}
              subtitle={sub(t('more.pocketsFoot', { count: pockets?.items.length ?? 0, amount: ltrIsolate(formatPaisa(totalPocketPaisa)) }))}
              right={chevron}
            />
            <ListRow
              testID="more-card"
              onPress={() => router.push('/card')}
              left={<IconSquare icon={CreditCard} />}
              title={t('more.card')}
              subtitle={sub(me?.card.frozen ? t('card.frozen') : t('more.cardFoot'))}
              right={chevron}
            />
            <ListRow
              testID="more-statements"
              onPress={() => router.push('/statements')}
              left={<IconSquare icon={FileText} />}
              title={t('more.statements')}
              right={chevron}
            />
            <ListRow
              testID="more-requests"
              onPress={() => router.push('/requests')}
              left={<IconSquare icon={ArrowDownLeft} />}
              title={t('more.requests')}
              subtitle={pendingRequests > 0 ? sub(t('more.requestsFoot', { count: pendingRequests })) : undefined}
              right={chevron}
              separator={false}
            />
          </Card>
        </View>

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('more.account')}</SectionLabel>
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="more-language"
              onPress={() => router.push('/profile')}
              left={<IconSquare icon={Languages} />}
              title={t('more.language')}
              subtitle={sub(languageLabel)}
              right={chevron}
            />
            <ListRow
              testID="more-settings"
              onPress={() => router.push('/settings')}
              left={<IconSquare icon={SettingsIcon} />}
              title={t('more.settings')}
              subtitle={sub(t('more.settingsFoot'))}
              right={chevron}
            />
            <ListRow
              testID="more-security"
              left={<IconSquare icon={Shield} />}
              title={t('more.security')}
              right={chevron}
            />
            <ListRow
              testID="more-notifications"
              left={<IconSquare icon={Bell} />}
              title={t('more.notifications')}
              right={chevron}
            />
            <ListRow
              testID="more-help"
              left={<IconSquare icon={LifeBuoy} />}
              title={t('more.help')}
              right={chevron}
              separator={false}
            />
          </Card>
        </View>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="more-logout"
            onPress={() => dispatch(signedOut())}
            left={<IconSquare icon={LogOut} tint="danger" />}
            title={<Text variant="hl" color={c.red}>{t('auth.logout')}</Text>}
            right={chevron}
            separator={false}
          />
        </Card>

        <Text variant="foot" center>{t('more.version')}</Text>
      </ScrollView>
    </Screen>
  );
}

/** B13 profile card: cream 72 pt avatar, name 22/700, phone · PAYO wallet, chevron. */
function ProfileCard({ testID, latinName, name, sub, onPress }: {
  testID: string;
  latinName: string;
  name: string;
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
      accessibilityLabel={name}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={press.style}
    >
      <Card style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.l }}>
        {/* Initials from the Latin name so the disc reads "AJ" in both languages. */}
        <Avatar name={latinName || name || '?'} size={PROFILE_AVATAR} bg={c.cream} color={c.navy} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="h2" color={c.ink} numberOfLines={1}>{name}</Text>
          <Text variant="sub" color={c.ink2} numberOfLines={1}>{sub}</Text>
        </View>
        <Chevron />
      </Card>
    </AnimatedPressable>
  );
}

/** Section label — 12/600 uppercase, letter-spacing 0.96, ink3 (§2). */
function SectionLabel({ children }: { children: string }) {
  const urdu = useIsUrdu();
  return <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{children}</Text>;
}

/** The row's leading 56 pt icon square: amberTint + amber icon (redTint + red for danger). */
function IconSquare({ icon: Icon, tint }: { icon: LucideIcon; tint?: 'danger' }) {
  const { c } = useTheme();
  const bg = tint === 'danger' ? c.redTint : c.amberTint;
  const color = tint === 'danger' ? c.red : c.amber;
  return (
    <View style={{ width: ICON_BOX, height: ICON_BOX, borderRadius: ICON_BOX_RADIUS, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={ICON} color={color} strokeWidth={2} />
    </View>
  );
}

/** A trailing chevron that points the way the row reads (ListRow's own one never mirrors). */
function Chevron() {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  // A flipped Svg does not render reliably — use the mirrored glyph instead.
  return urdu
    ? <ChevronLeft size={20} color={c.ink3} strokeWidth={2} />
    : <ChevronRight size={20} color={c.ink3} strokeWidth={2} />;
}

import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownLeft, ArrowUpRight, AudioLines, Eye, EyeOff, Mic, PiggyBank, QrCode,
  Send, Smartphone, Zap, type LucideIcon,
} from 'lucide-react-native';
import { Text, Card, Avatar, ListRow, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, glassTokens, touch } from '../../src/theme/tokens';
import { useCountUp, useFirstPaint, Rise, usePressScale, motionConfig } from '../../src/motion';
import { useMeQuery, useDueBillsQuery, useTransactionsQuery, useRecipientsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { formatRelativeDay, formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import { orbBus, useOrbState } from '../../src/voice/orbBus';
import type { RecipientDto, Txn } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { STAGGER } = motionConfig;
const { orb: ORB, dueBill: DUE_BILL, line: LINE } = glassTokens;

/** GLASS-SPEC §2 "Head row": 40 pt avatar, name 17/700, sub-line 14 ink2. */
const HEAD_AVATAR = 40;
/** Artboard: `padding:56px 20px 0` — status bar plus a little, off the safe area. */
const HEAD_PADDING_ABOVE_INSET = 10;
/** B5: the balance runs at 44/800, bigger than the 40 pt `money` variant. */
const BALANCE_SIZE = 44;
const BALANCE_LINE_HEIGHT = 52;
/** B5: Send/Request are 56 pt pills; the QR button is a 64 pt glass disc (§5). */
const QR_SIZE = 64;
const TILE_ICON = 24;
const ORB_ICON = 24;
/** Android's stand-in for the coloured shadow: a translucent amber disc (§3). */
const ORB_HALO = Math.round(ORB.mini * ORB.androidHaloScale);
const PAY_PILL_HEIGHT = 40;

const QUICK_ACTIONS: { key: string; labelKey: string; icon: LucideIcon; href: string }[] = [
  { key: 'send', labelKey: 'wallet.tile.send', icon: Send, href: '/send' },
  { key: 'bills', labelKey: 'wallet.tile.bills', icon: Zap, href: '/bills' },
  { key: 'topup', labelKey: 'wallet.tile.topup', icon: Smartphone, href: '/recharge' },
  { key: 'savings', labelKey: 'wallet.tile.savings', icon: PiggyBank, href: '/pockets' },
];

function txnTypeLabel(type: Txn['type'], t: (k: string) => string): string {
  switch (type) {
    case 'bill': return t('activity.filter.bills');
    case 'recharge': return t('activity.filter.recharge');
    case 'pocket_deposit':
    case 'pocket_withdraw':
      return t('activity.filter.savings');
    default:
      return t('wallet.txnTransfer');
  }
}

/** v8 Urdu QA: an outgoing send carries no `urduName` — the backend writes the
 *  recipient's title + identifier only (transferExecutors.ts) — so the saved
 *  recipient is looked up by identifier (then by title) and the row names the
 *  person the way the user says it in Urdu (urduNickname, else urduTitle). */
function urduCounterpartyName(txn: Txn, recipients: RecipientDto[] | undefined): string | undefined {
  if (txn.counterparty.urduName) return txn.counterparty.urduName;
  const r = recipients?.find((x) => x.identifier === txn.counterparty.detail)
    ?? recipients?.find((x) => x.title === txn.counterparty.name);
  return r?.urduNickname || r?.urduTitle || undefined;
}

// Wallet — GLASS-SPEC §5 B5. Transparent root: the tabs layout paints the one
// gradient behind every scene. Head row (avatar · name · "PAYO wallet · PKR")
// with the 56 pt mini orb on the right, "Available balance", the 44/800 cream
// balance with its eye toggle, Send (amber) · Request (glass) · QR (glass disc),
// four glass quick tiles, the amber-tinted due-bill card, and RECENT ACTIVITY
// as one glass card holding the three rows. Nothing here is a sheet any more.
export default function Wallet() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMeQuery();
  const { data: due } = useDueBillsQuery();
  const { data: txns } = useTransactionsQuery({});
  // Only Urdu needs the recipient lookup (see urduCounterpartyName); Home has
  // usually fetched this list already, so it is a cache hit, not a request.
  const { data: recipients } = useRecipientsQuery(undefined, { skip: !urdu });
  const [revealed, setRevealed] = useState(true);
  const firstPaint = useFirstPaint();

  const balancePaisa = useCountUp(me?.account.balancePaisa ?? 0);
  const dueBill = due?.items?.[0];
  const recent = (txns?.items ?? []).slice(0, 3);
  const balanceText = formatPaisa(balancePaisa);
  // v8 Urdu QA: the header greets the user by their Urdu name on an Urdu screen.
  const name = (urdu && me?.user.urduName ? me.user.urduName : me?.user.name) || t('wallet.title');
  const lang = urdu ? 'ur' : 'en';
  const now = new Date();

  // First-paint stagger (spec §3 STAGGER) for the body rows only — never
  // replayed on a tab re-focus or a re-render (useFirstPaint latches).
  const rowDelays = [0, 1, 2].map((i) => (firstPaint ? i * STAGGER : 0));

  // The mini orb (§3): we are never on Home here, so go there whether Home's
  // handler ran just now (the loop is starting) or the start was latched for
  // Home to consume on focus — the same rule the nav orb follows in (tabs)/_layout.
  const onOrbPress = () => {
    orbBus.press();
    router.push('/(tabs)');
  };

  const row = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + HEAD_PADDING_ABOVE_INSET,
          paddingHorizontal: space.gutter,
          paddingBottom: space.xl,
          gap: space.l,
        }}
      >
        <View testID="wallet-head" style={[row, { gap: space.m }]}>
          <Avatar name={me?.user.name || 'PAYO'} size={HEAD_AVATAR} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="hl" weight={700} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 22 }}>
              {name}
            </Text>
            <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
              {t('wallet.headSub')}
            </Text>
          </View>
          <MiniOrb testID="wallet-orb" onPress={onOrbPress} />
        </View>
        {/* Not yet wired to a notifications screen. This inert marker keeps the
            testID a pre-rewrite wallet screen exposed for existing QA tooling. */}
        <View
          testID="wallet-notifications"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 0, height: 0, marginTop: -space.l }}
        />

        <View style={{ gap: space.xs }}>
          <Text variant="sub" color={c.ink2} style={{ lineHeight: urdu ? undefined : 20 }}>{t('wallet.available')}</Text>
          <Pressable
            testID="wallet-balance-toggle"
            accessibilityRole="button"
            accessibilityLabel={t('home.balance')}
            onPress={() => setRevealed((s) => !s)}
            hitSlop={8}
            style={[row, { gap: space.m, alignSelf: urdu ? 'flex-end' : 'flex-start' }]}
          >
            <Text variant="money" color={c.ink} style={{ fontSize: BALANCE_SIZE, lineHeight: BALANCE_LINE_HEIGHT }}>
              {revealed ? (urdu ? ltrIsolate(balanceText) : balanceText) : '₨ ••••••'}
            </Text>
            {revealed
              ? <EyeOff size={22} color={c.ink3} strokeWidth={2} />
              : <Eye size={22} color={c.ink3} strokeWidth={2} />}
          </Pressable>
        </View>

        <View style={[row, { gap: space.m }]}>
          <ActionPill testID="wallet-send" amber icon={ArrowUpRight} label={t('wallet.send')} onPress={() => router.push('/send')} />
          <ActionPill testID="wallet-request" icon={ArrowDownLeft} label={t('wallet.request')} onPress={() => router.push('/requests/new')} />
          <GlassPress
            testID="wallet-qr"
            accessibilityLabel={t('pay.tile.qr')}
            onPress={() => router.push('/qr')}
            style={{ width: QR_SIZE, height: QR_SIZE, borderRadius: QR_SIZE / 2, alignItems: 'center', justifyContent: 'center' }}
          >
            <QrCode size={24} color={c.ink} strokeWidth={2.2} />
          </GlassPress>
        </View>

        <View testID="wallet-sheet" style={{ gap: space.l }}>
          <Rise delay={rowDelays[0]}>
            <View style={[row, { gap: space.m, alignItems: 'stretch' }]}>
              {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, href }) => (
                <GlassPress
                  key={key}
                  testID={`wallet-quick-${key}`}
                  accessibilityLabel={t(labelKey)}
                  onPress={() => router.push(href)}
                  style={{ flex: 1, borderRadius: radius.tile, paddingVertical: space.xl, paddingHorizontal: space.xs, alignItems: 'center', gap: space.m }}
                >
                  <Icon size={TILE_ICON} color={c.amber} strokeWidth={2.2} />
                  <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} style={{ lineHeight: urdu ? undefined : 20 }}>
                    {t(labelKey)}
                  </Text>
                </GlassPress>
              ))}
            </View>
          </Rise>

          {dueBill ? (
            <Rise delay={rowDelays[1]}>
              <Pressable
                testID="wallet-due-bill"
                accessibilityRole="button"
                onPress={() => router.push('/bills')}
                style={[row, {
                  gap: space.m, padding: space.l, borderRadius: radius.card,
                  backgroundColor: DUE_BILL.fill, borderWidth: LINE, borderColor: DUE_BILL.line,
                }]}
              >
                <Zap size={24} color={c.amber} strokeWidth={2.2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="hl" weight={600} color={c.ink} numberOfLines={2} style={{ lineHeight: urdu ? undefined : 22 }}>
                    {t('wallet.dueBill.title', {
                      biller: urdu && dueBill.biller.urduName ? dueBill.biller.urduName : dueBill.biller.name,
                      date: formatShortDate(dueBill.dueDate, now, lang),
                    })}
                  </Text>
                  <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
                    {t('wallet.dueBill.foot', {
                      amount: urdu ? ltrIsolate(formatPaisa(dueBill.amountPaisa)) : formatPaisa(dueBill.amountPaisa),
                      last4: dueBill.consumerNo.slice(-4),
                    })}
                  </Text>
                </View>
                <View style={{ height: PAY_PILL_HEIGHT, paddingHorizontal: 18, borderRadius: PAY_PILL_HEIGHT / 2, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="hl" weight={700} color={c.onAmber} style={{ lineHeight: urdu ? undefined : 22 }}>{t('wallet.dueBill.pay')}</Text>
                </View>
              </Pressable>
            </Rise>
          ) : null}

          <Rise delay={rowDelays[dueBill ? 2 : 1]}>
            <View style={{ gap: space.s }}>
              <View style={[row, { justifyContent: 'space-between' }]}>
                <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{t('wallet.recent')}</Text>
                <Pressable testID="wallet-see-all" accessibilityRole="button" onPress={() => router.push('/activity')} hitSlop={8}>
                  <Text variant="sub" weight={700} color={c.amber}>{t('wallet.seeAll')}</Text>
                </Pressable>
              </View>
              <Card padding={0} style={{ paddingHorizontal: space.l }}>
                {recent.map((txn, i) => (
                  <TxnRow key={txn.id} txn={txn} recipients={recipients?.items} separator={i < recent.length - 1} />
                ))}
                {recent.length === 0 ? (
                  <Text variant="sub" center style={{ paddingVertical: space.l }}>{t('activity.empty')}</Text>
                ) : null}
              </Card>
            </View>
          </Rise>
        </View>
      </ScrollView>
    </View>
  );
}

/** The 56 pt amber mini orb (GLASS-SPEC §3) in the head row's right slot. It
 *  never mirrors. Shows AudioLines while Home's loop is listening, Mic otherwise. */
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

/** A pressable glass object: `surface` fill, the 1 px line, press scale. */
function GlassPress({ children, style, testID, accessibilityLabel, onPress }: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  testID: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const press = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[{ backgroundColor: c.surface, borderWidth: LINE, borderColor: c.separator }, style, press.style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Send (amber) / Request (glass): a 56 pt pill with a leading icon. */
function ActionPill({ testID, amber, icon: Icon, label, onPress }: {
  testID: string;
  amber?: boolean;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const press = usePressScale();
  const color = amber ? c.onAmber : c.ink;
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
          flex: 1, height: touch.primary, borderRadius: radius.button,
          backgroundColor: amber ? c.amber : c.surface,
          borderWidth: amber ? 0 : LINE, borderColor: c.separator,
          flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: space.s,
        },
        press.style,
      ]}
    >
      <Icon size={20} color={color} strokeWidth={2.4} />
      <Text variant="hl" weight={700} color={color} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 22 }}>{label}</Text>
    </AnimatedPressable>
  );
}

function TxnRow({ txn, recipients, separator }: { txn: Txn; recipients: RecipientDto[] | undefined; separator: boolean }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const name = (urdu ? urduCounterpartyName(txn, recipients) : undefined) ?? txn.counterparty.name;
  const amountColor = txn.direction === 'in' ? c.green : c.ink;
  const sign = txn.direction === 'in' ? '+' : '−';
  const amount = sign + formatPaisa(txn.amountPaisa);
  const when = formatRelativeDay(txn.createdAt, new Date(), urdu ? 'ur' : 'en');

  return (
    <ListRow
      testID={`wallet-txn-${txn.id}`}
      separator={separator}
      // Initials come from the Latin name so the disc reads "AB" in both languages (B5).
      left={<Avatar name={txn.counterparty.name} size={44} />}
      title={<Text variant="hl" weight={700} numberOfLines={1}>{name}</Text>}
      subtitle={(
        <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
          {`${when} · ${txnTypeLabel(txn.type, t)}`}
        </Text>
      )}
      right={(
        <Text variant="hl" weight={700} color={amountColor}>
          {urdu ? ltrIsolate(amount) : amount}
        </Text>
      )}
    />
  );
}

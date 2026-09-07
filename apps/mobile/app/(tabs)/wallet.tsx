import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Grid2x2, PiggyBank,
  Send, Smartphone, Wallet as WalletIcon, Zap, type LucideIcon,
} from 'lucide-react-native';
import {
  Text, Card, Avatar, Pill, NavyHead, Sheet, ListRow, useIsUrdu, SHEET_OVERLAP,
} from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, shadow, dark as onNavy } from '../../src/theme/tokens';
import { useCountUp, useFirstPaint, Rise, motionConfig } from '../../src/motion';
import { useMeQuery, useDueBillsQuery, useTransactionsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { formatRelativeDay, formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { Txn } from '../../src/api/types';

const { STAGGER } = motionConfig;

/** NavyHead's own box: avatar row + the "name · PAYO wallet · PKR" line only —
 *  the balance and Send/Request/QR row are Wallet-local (below) so the
 *  balance can run at the 40 pt `money` size, not NavyHead's 22 pt one. */
const WALLET_HEAD_HEIGHT = 210;

const QUICK_ACTIONS: { key: string; labelKey: string; icon: LucideIcon; href: string }[] = [
  { key: 'send', labelKey: 'wallet.quickAction.send', icon: Send, href: '/send' },
  { key: 'bills', labelKey: 'wallet.quickAction.bills', icon: Zap, href: '/bills' },
  { key: 'topup', labelKey: 'wallet.quickAction.topup', icon: Smartphone, href: '/recharge' },
  { key: 'savings', labelKey: 'wallet.quickAction.savings', icon: PiggyBank, href: '/pockets' },
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

// Wallet — Wallet.dc.html: navy head (avatar + "Ammi Jaan · PAYO wallet · PKR")
// with the balance + Send/Request/QR row sitting on the same navy ground, a
// cream sheet (quick actions, due bill, recent activity) overlapping the seam
// by SHEET_OVERLAP — the same NavyHead + Sheet vocabulary as Home. The AIBar
// docked above the tab bar is rendered by (tabs)/_layout.tsx, not here.
export default function Wallet() {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data: me } = useMeQuery();
  const { data: due } = useDueBillsQuery();
  const { data: txns } = useTransactionsQuery({});
  const [revealed, setRevealed] = useState(true);
  const firstPaint = useFirstPaint();

  const balancePaisa = useCountUp(me?.account.balancePaisa ?? 0);
  const dueBill = due?.items?.[0];
  const recent = (txns?.items ?? []).slice(0, 3);
  const balanceText = formatPaisa(balancePaisa);

  // First-paint stagger (spec §3 STAGGER) for the sheet's rows only — never
  // replayed on a tab re-focus or a re-render (useFirstPaint latches).
  const rowDelays = [0, 1, 2].map((i) => (firstPaint ? i * STAGGER : 0));

  return (
    <View style={{ flex: 1, backgroundColor: c.navy }}>
      <NavyHead
        testID="wallet-head"
        name={me?.user.name || t('wallet.title')}
        greetingFoot={t('wallet.available')}
        greeting={t('wallet.balanceFoot', { name: me?.user.name ?? '' })}
        balancePaisa={null}
        status="none"
        height={WALLET_HEAD_HEIGHT}
        urdu={urdu}
        animateGreeting={false}
      />
      {/* Not yet wired to a notifications screen. NavyHead already draws the
          bell glyph (decorative); this inert marker just keeps the testID a
          pre-rewrite wallet screen exposed for existing QA tooling. */}
      <View
        testID="wallet-notifications"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 0, height: 0 }}
      />

      <View style={{ backgroundColor: c.navy, paddingHorizontal: space.gutter, paddingBottom: space.l, gap: space.m }}>
        <Pressable
          testID="wallet-balance-toggle"
          accessibilityRole="button"
          accessibilityLabel={t('home.balance')}
          onPress={() => setRevealed((s) => !s)}
          hitSlop={8}
          style={{
            flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'baseline', gap: space.s,
            alignSelf: urdu ? 'flex-end' : 'flex-start',
          }}
        >
          <Text variant="money" color={onNavy.ink}>
            {revealed ? (urdu ? ltrIsolate(balanceText) : balanceText) : '₨ ••••••'}
          </Text>
          {revealed
            ? <EyeOff size={16} color={onNavy.ink2} strokeWidth={2} />
            : <Eye size={16} color={onNavy.ink2} strokeWidth={2} />}
        </Pressable>

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: 10 }}>
          <Pressable
            testID="wallet-send"
            onPress={() => router.push('/send')}
            style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: c.amber, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <ArrowUpRight size={20} color={c.navy} strokeWidth={2.4} />
            <Text variant="hl" weight={700} color={c.navy}>{t('wallet.send')}</Text>
          </Pressable>
          <Pressable
            testID="wallet-request"
            onPress={() => router.push('/requests/new')}
            style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <ArrowDownLeft size={20} color={c.ink} strokeWidth={2.4} />
            <Text variant="hl" weight={700} color={c.ink}>{t('wallet.request')}</Text>
          </Pressable>
          <Pressable
            testID="wallet-qr"
            onPress={() => router.push('/qr')}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Grid2x2 size={22} color={c.ink} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <Sheet testID="wallet-sheet" animate={firstPaint} style={{ marginTop: -SHEET_OVERLAP }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
          <Rise delay={rowDelays[0]}>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
              {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, href }) => (
                <Pressable
                  key={key}
                  testID={`wallet-quick-${key}`}
                  onPress={() => router.push(href)}
                  style={[
                    {
                      flex: 1, borderRadius: radius.tile, backgroundColor: c.surface,
                      paddingVertical: space.m, paddingHorizontal: space.xs,
                      alignItems: 'center', gap: space.s,
                    },
                    dark ? shadow.card.dark : shadow.card.light,
                  ]}
                >
                  <Icon size={22} color={c.navy} strokeWidth={2.2} />
                  <Text variant="foot" weight={600} color={c.ink2} center style={{ fontSize: 11, lineHeight: 14 }}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Rise>

          {dueBill ? (
            <Rise delay={rowDelays[1]}>
              <Pressable testID="wallet-due-bill" onPress={() => router.push('/bills')}>
                <Card style={{ backgroundColor: c.amberTint }}>
                  <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={20} color={c.navy} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="hl" style={{ fontSize: 15, lineHeight: 19 }} numberOfLines={1}>
                        {t('wallet.dueBill.title', { biller: urdu && dueBill.biller.urduName ? dueBill.biller.urduName : dueBill.biller.name, date: formatShortDate(dueBill.dueDate) })}
                      </Text>
                      <Text variant="foot" numberOfLines={1}>
                        {t('wallet.dueBill.foot', { amount: formatPaisa(dueBill.amountPaisa), last4: dueBill.consumerNo.slice(-4) })}
                      </Text>
                    </View>
                    <Pill label={t('wallet.dueBill.pay')} bg={c.amber} color={c.navy} />
                  </View>
                </Card>
              </Pressable>
            </Rise>
          ) : null}

          <Rise delay={rowDelays[dueBill ? 2 : 1]}>
            <View>
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs }}>
                <Text variant="cap">{t('wallet.recent')}</Text>
                <Pressable testID="wallet-see-all" onPress={() => router.push('/activity')} hitSlop={8}>
                  <Text variant="sub" weight={700} color={c.amberDeep}>{t('wallet.seeAll')}</Text>
                </Pressable>
              </View>
              <Card padding={0} style={{ paddingHorizontal: space.l }}>
                {recent.map((txn, i) => (
                  <TxnRow key={txn.id} txn={txn} separator={i < recent.length - 1} />
                ))}
              </Card>
            </View>
          </Rise>
        </ScrollView>
      </Sheet>
    </View>
  );
}

function TxnRow({ txn, separator }: { txn: Txn; separator: boolean }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
  const isTransfer = txn.type === 'bank_transfer';
  const amountColor = txn.direction === 'in' ? c.green : c.ink;
  const sign = txn.direction === 'in' ? '+' : '−';

  return (
    <ListRow
      testID={`wallet-txn-${txn.id}`}
      separator={separator}
      left={isTransfer ? (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <WalletIcon size={20} color={c.navy} strokeWidth={2} />
        </View>
      ) : (
        <Avatar name={name} size={40} bg={c.surface2} color={c.navy} />
      )}
      title={name}
      subtitle={`${formatRelativeDay(txn.createdAt)} · ${txnTypeLabel(txn.type, t)}`}
      right={(
        <Text variant="hl" style={{ fontSize: 15 }} color={amountColor}>
          {urdu ? ltrIsolate(sign + formatPaisa(txn.amountPaisa)) : sign + formatPaisa(txn.amountPaisa)}
        </Text>
      )}
    />
  );
}

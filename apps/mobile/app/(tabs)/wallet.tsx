import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft, ArrowUpRight, Bell, Eye, EyeOff, Grid2x2, PiggyBank,
  Send, Smartphone, Wallet as WalletIcon, Zap, type LucideIcon,
} from 'lucide-react-native';
import { Screen, Text, Card, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';
import { useCountUp } from '../../src/motion';
import { useMeQuery, useDueBillsQuery, useTransactionsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { formatRelativeDay, formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { Txn } from '../../src/api/types';

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

// Wallet — Wallet.dc.html: header + BalanceCard (Send/Request/QR) +
// QuickActions + optional due-bill strip + Recent activity. The AIBar
// docked above the tab bar is rendered by (tabs)/_layout.tsx, not here.
export default function Wallet() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data: me } = useMeQuery();
  const { data: due } = useDueBillsQuery();
  const { data: txns } = useTransactionsQuery({});
  const [revealed, setRevealed] = useState(true);

  const balancePaisa = useCountUp(me?.account.balancePaisa ?? 0);
  const dueBill = due?.items?.[0];
  const recent = (txns?.items ?? []).slice(0, 3);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.gutter }}>
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.l, paddingBottom: space.s }}>
          <Text variant="h2" weight={800}>{t('wallet.title')}</Text>
          {/* Not yet wired to a notifications screen — plain, dimmed View (not
              Pressable) so it doesn't invite a tap that does nothing. */}
          <View
            testID="wallet-notifications"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}
          >
            <Bell size={22} color={c.ink} strokeWidth={2} />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: space.xl, gap: space.xl }}>
        <Card style={{ gap: space.m }}>
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="cap">{t('wallet.available')}</Text>
            <Pressable testID="wallet-balance-toggle" onPress={() => setRevealed((s) => !s)} hitSlop={8}>
              {revealed
                ? <EyeOff size={20} color={c.ink3} strokeWidth={2} />
                : <Eye size={20} color={c.ink3} strokeWidth={2} />}
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            {revealed ? (
              <>
                <Text variant="money">{'₨' + Math.floor(balancePaisa / 100).toLocaleString('en-PK')}</Text>
                <Text variant="h2" color={c.ink3}>.{String(Math.round(balancePaisa) % 100).padStart(2, '0')}</Text>
              </>
            ) : (
              <Text variant="money">₨ ••••••</Text>
            )}
          </View>
          <Text variant="foot">{t('wallet.balanceFoot', { name: me?.user.name ?? '' })}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xs }}>
            <Pressable
              testID="wallet-send"
              onPress={() => router.push('/send')}
              style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: c.amber, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <ArrowUpRight size={20} color={c.navy} strokeWidth={2.4} />
              <Text variant="hl" weight={700} color={c.navy}>{t('wallet.send')}</Text>
            </Pressable>
            <Pressable
              testID="wallet-request"
              onPress={() => router.push('/requests/new')}
              style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: c.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <ArrowDownLeft size={20} color={c.ink} strokeWidth={2.4} />
              <Text variant="hl" weight={600}>{t('wallet.request')}</Text>
            </Pressable>
            <Pressable
              testID="wallet-qr"
              onPress={() => router.push('/qr')}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Grid2x2 size={22} color={c.ink} strokeWidth={2.2} />
            </Pressable>
          </View>
        </Card>

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
          {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, href }) => (
            <Pressable
              key={key}
              testID={`wallet-quick-${key}`}
              onPress={() => router.push(href)}
              style={{ flex: 1, alignItems: 'center', gap: space.s }}
            >
              <View
                style={{
                  width: 56, height: 56, borderRadius: radius.tile, backgroundColor: c.surface,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon size={24} color={c.navy} strokeWidth={2.2} />
              </View>
              <Text variant="foot" weight={600} color={c.ink2} center>{t(labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {dueBill ? (
          <Pressable testID="wallet-due-bill" onPress={() => router.push('/bills')}>
            <View
              style={{
                backgroundColor: c.surface2, borderRadius: radius.card, padding: space.l,
                flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.redTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={22} color={c.red} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" numberOfLines={1}>
                  {t('wallet.dueBill.title', { biller: urdu && dueBill.biller.urduName ? dueBill.biller.urduName : dueBill.biller.name, date: formatShortDate(dueBill.dueDate) })}
                </Text>
                <Text variant="foot" numberOfLines={1}>
                  {t('wallet.dueBill.foot', { amount: formatPaisa(dueBill.amountPaisa), last4: dueBill.consumerNo.slice(-4) })}
                </Text>
              </View>
              <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="cap" weight={700} color={c.navy} style={{ textTransform: 'none', letterSpacing: undefined, lineHeight: undefined, fontSize: 12 }}>
                  {t('wallet.dueBill.pay')}
                </Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View>
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs }}>
            <Text variant="hl">{t('wallet.recent')}</Text>
            <Pressable testID="wallet-see-all" onPress={() => router.push('/activity')} hitSlop={8}>
              <Text variant="sub" weight={700} color={c.amberDeep}>{t('wallet.seeAll')}</Text>
            </Pressable>
          </View>
          {recent.map((txn, i) => (
            <TxnRow key={txn.id} txn={txn} separator={i < recent.length - 1} />
          ))}
        </View>
      </ScrollView>
    </Screen>
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
    <View
      style={{
        flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, borderBottomWidth: separator ? 1 : 0, borderBottomColor: c.separator,
      }}
    >
      {isTransfer ? (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <WalletIcon size={22} color={c.onAmber} strokeWidth={2} />
        </View>
      ) : (
        <Avatar name={name} bg={c.amberTint} color={c.onAmber} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="hl" numberOfLines={1}>{name}</Text>
        <Text variant="foot" numberOfLines={1}>{formatRelativeDay(txn.createdAt)} · {txnTypeLabel(txn.type, t)}</Text>
      </View>
      <Text variant="hl" color={amountColor}>
        {urdu ? ltrIsolate(sign + formatPaisa(txn.amountPaisa)) : sign + formatPaisa(txn.amountPaisa)}
      </Text>
    </View>
  );
}

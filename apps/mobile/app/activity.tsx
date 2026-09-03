import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Wallet as WalletIcon, Zap, Smartphone, PiggyBank, ArrowLeftRight, type LucideIcon,
} from 'lucide-react-native';
import { Screen, Text, Card, Chip, Avatar, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space } from '../src/theme/tokens';
import { useTransactionsQuery } from '../src/api/client';
import { formatPaisa } from '../src/lib/money';
import { formatRelativeDay } from '../src/lib/dates';
import { ltrIsolate } from '../src/lib/bidi';
import type { Txn } from '../src/api/types';

const FILTERS = [
  { key: 'all', labelKey: 'activity.all' },
  { key: 'bills', labelKey: 'activity.filter.bills', category: 'bills' },
  { key: 'transfer', labelKey: 'activity.filter.transfer', category: 'transfer' },
  { key: 'recharge', labelKey: 'activity.filter.recharge', category: 'recharge' },
  { key: 'savings', labelKey: 'activity.filter.savings', category: 'savings' },
] as const;

// Short month names for the group headers ("Today" / "August") — matches the
// small localized-month-array pattern already used by statements/index.tsx,
// since Intl month names aren't reliably available for 'ur' on-device.
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const UR_MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function txnTypeLabel(type: Txn['type'], t: (k: string) => string): string {
  switch (type) {
    case 'bill': return t('activity.filter.bills');
    case 'recharge': return t('activity.filter.recharge');
    case 'pocket_deposit':
    case 'pocket_withdraw':
      return t('activity.filter.savings');
    default:
      return t('activity.filter.transfer');
  }
}

// Icon-circle rows follow theme tokens only (amberTint/onAmber neutral, redTint/red
// for bills) rather than Activity.dc.html's extra blue swatch, which isn't a
// Palette token — see r6b-report.md for this deviation.
function txnVisual(type: Txn['type']): { icon: LucideIcon | null } {
  switch (type) {
    case 'bank_transfer': return { icon: WalletIcon };
    case 'bill': return { icon: Zap };
    case 'recharge': return { icon: Smartphone };
    case 'pocket_deposit':
    case 'pocket_withdraw': return { icon: PiggyBank };
    case 'request_settlement': return { icon: ArrowLeftRight };
    default: return { icon: null }; // p2p → avatar initials
  }
}

interface Group { label: string; items: Txn[] }

function groupByPeriod(items: Txn[], now: Date, urdu: boolean, t: (k: string) => string): Group[] {
  const months = urdu ? UR_MONTHS : EN_MONTHS;
  const groups = new Map<string, Group>();
  for (const txn of items) {
    const d = new Date(txn.createdAt);
    let key: string;
    let label: string;
    if (sameDay(d, now)) {
      key = 'today';
      label = t('activity.today');
    } else {
      const yearSuffix = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = months[d.getMonth()] + yearSuffix;
    }
    const g = groups.get(key);
    if (g) g.items.push(txn);
    else groups.set(key, { label, items: [txn] });
  }
  return Array.from(groups.values());
}

type Row = { kind: 'header'; label: string } | { kind: 'txn'; txn: Txn };

export default function Activity() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [filter, setFilter] = useState<{ key: string; labelKey: string; category?: string }>(FILTERS[0]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const { data, isFetching, refetch } = useTransactionsQuery({ category: filter.category, cursor });
  // Separate, unfiltered feed for the month summary card so switching a
  // filter chip doesn't change "Spent in September" — best-effort from the
  // first loaded page; there's no dedicated stats endpoint yet.
  const { data: allData } = useTransactionsQuery({});

  const items = data?.items ?? [];
  const now = useMemo(() => new Date(), []);

  const monthName = (urdu ? UR_MONTHS : EN_MONTHS)[now.getMonth()];
  const { spentPaisa, receivedPaisa } = useMemo(() => {
    let spent = 0;
    let received = 0;
    for (const txn of allData?.items ?? []) {
      const d = new Date(txn.createdAt);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
      if (txn.direction === 'in') received += txn.amountPaisa;
      else spent += txn.amountPaisa;
    }
    return { spentPaisa: spent, receivedPaisa: received };
  }, [allData, now]);

  const rows: Row[] = useMemo(() => {
    const groups = groupByPeriod(items, now, urdu, t);
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: 'header', label: g.label });
      for (const txn of g.items) out.push({ kind: 'txn', txn });
    }
    return out;
  }, [items, now, urdu, t]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="activity-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{t('activity.title')}</Text>
      </View>

      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s, marginBottom: space.l, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            testID={`filter-${f.key}`}
            label={t(f.labelKey)}
            selected={filter.key === f.key}
            onPress={() => { setCursor(undefined); setFilter(f); }}
          />
        ))}
      </View>

      <Card padding={space.m} style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: space.l }}>
        <View>
          <Text variant="cap">{t('activity.spentIn', { month: monthName })}</Text>
          <Text variant="h2" style={{ marginTop: 4 }}>{ltrIsolate(formatPaisa(spentPaisa))}</Text>
        </View>
        <View style={{ alignItems: urdu ? 'flex-start' : 'flex-end' }}>
          <Text variant="cap">{t('activity.in')}</Text>
          <Text variant="h2" color={c.green} style={{ marginTop: 4 }}>{ltrIsolate(formatPaisa(receivedPaisa))}</Text>
        </View>
      </Card>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'header' ? `h-${r.label}-${i}` : r.txn.id)}
        refreshing={isFetching && !cursor}
        onRefresh={() => { setCursor(undefined); refetch(); }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (data?.nextCursor && !isFetching) setCursor(data.nextCursor);
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text color={c.ink3} center>{isFetching ? t('common.loading') : t('activity.empty')}</Text>
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <Text variant="cap" style={{ marginTop: space.m, marginBottom: 6 }}>{item.label}</Text>;
          }
          const txn = item.txn;
          const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
          const { icon: Icon } = txnVisual(txn.type);
          const amountColor = txn.direction === 'in' ? c.green : c.ink;
          const sign = txn.direction === 'in' ? '+' : '−';
          const amount = sign + formatPaisa(txn.amountPaisa);

          return (
            <Pressable
              testID={`txn-${txn.refNo}`}
              onPress={() => router.push({ pathname: '/txn/[id]', params: { id: txn.id, data: JSON.stringify(txn) } })}
              style={{
                flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.separator,
              }}
            >
              {Icon ? (
                <View style={{
                  width: 44, height: 44, borderRadius: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: txn.type === 'bill' ? c.redTint : c.amberTint,
                }}>
                  <Icon size={22} color={txn.type === 'bill' ? c.red : c.onAmber} strokeWidth={2} />
                </View>
              ) : (
                <Avatar name={name} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" numberOfLines={1}>{name}</Text>
                <Text variant="foot" numberOfLines={1}>{formatRelativeDay(txn.createdAt)} · {txnTypeLabel(txn.type, t)}</Text>
              </View>
              <Text variant="hl" color={amountColor}>{urdu ? ltrIsolate(amount) : amount}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

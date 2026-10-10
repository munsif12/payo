import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Chip, Avatar, InstitutionLogo, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, touch, glassTokens } from '../src/theme/tokens';
import { useTransactionsQuery, useRecipientsQuery } from '../src/api/client';
import { formatPaisa } from '../src/lib/money';
import { formatRelativeDay, monthName } from '../src/lib/dates';
import { ltrIsolate } from '../src/lib/bidi';
import type { RecipientDto, Txn } from '../src/api/types';

const FILTERS = [
  { key: 'all', labelKey: 'activity.all' },
  { key: 'bills', labelKey: 'activity.filter.bills', category: 'bills' },
  { key: 'transfer', labelKey: 'activity.filter.transfer', category: 'transfer' },
  { key: 'recharge', labelKey: 'activity.filter.recharge', category: 'recharge' },
  { key: 'savings', labelKey: 'activity.filter.savings', category: 'savings' },
] as const;

const ROW_AVATAR = 44;

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

interface Group { key: string; label: string; items: Txn[] }

/** "Today", then one group per calendar month ("October", "September 2025"). */
function groupByPeriod(items: Txn[], now: Date, lang: 'en' | 'ur', t: (k: string) => string): Group[] {
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
      label = monthName(d.getMonth(), lang) + yearSuffix;
    }
    const g = groups.get(key);
    if (g) g.items.push(txn);
    else groups.set(key, { key, label, items: [txn] });
  }
  return Array.from(groups.values());
}

// Activity — GLASS-SPEC §5 B15. Glass back button + title with the "All
// transactions" sub-line, the filter chips (glass / amber when selected), then
// one glass card per period holding its rows: 44 pt initials disc, name 17/700,
// "when · type" 14 ink2, and the amount (−cream / +green). Pagination and
// pull-to-refresh are unchanged.
export default function Activity() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [filter, setFilter] = useState<{ key: string; labelKey: string; category?: string }>(FILTERS[0]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const { data, isFetching, refetch } = useTransactionsQuery({ category: filter.category, cursor });
  // Only Urdu needs the recipient lookup (see urduCounterpartyName).
  const { data: recipients } = useRecipientsQuery(undefined, { skip: !urdu });

  const items = data?.items ?? [];
  const now = useMemo(() => new Date(), []);
  const lang = urdu ? 'ur' : 'en';

  const groups = useMemo(() => groupByPeriod(items, now, lang, t), [items, now, lang, t]);
  const row = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' } as const;

  return (
    <Screen>
      <BackHeader testID="activity-back" title={t('activity.title')} sub={t('activity.headSub')} onBack={() => router.back()} />

      <View style={[row, { gap: space.s, marginBottom: space.l, flexWrap: 'wrap' }]}>
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

      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        refreshing={isFetching && !cursor}
        onRefresh={() => { setCursor(undefined); refetch(); }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (data?.nextCursor && !isFetching) setCursor(data.nextCursor);
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}
        ListEmptyComponent={
          <Text variant="sub" center style={{ paddingVertical: space.xl }}>{isFetching ? t('common.loading') : t('activity.empty')}</Text>
        }
        renderItem={({ item: group }) => (
          <View style={{ gap: space.s }}>
            <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{group.label}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {group.items.map((txn, i) => (
                <TxnRow
                  key={txn.id}
                  txn={txn}
                  recipients={recipients?.items}
                  lang={lang}
                  separator={i < group.items.length - 1}
                  onPress={() => router.push({ pathname: '/txn/[id]', params: { id: txn.id, data: JSON.stringify(txn) } })}
                />
              ))}
            </Card>
          </View>
        )}
      />
    </Screen>
  );
}

function TxnRow({ txn, recipients, lang, separator, onPress }: {
  txn: Txn;
  recipients: RecipientDto[] | undefined;
  lang: 'en' | 'ur';
  separator: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = lang === 'ur';
  const name = (urdu ? urduCounterpartyName(txn, recipients) : undefined) ?? txn.counterparty.name;
  const amountColor = txn.direction === 'in' ? c.green : c.ink;
  const sign = txn.direction === 'in' ? '+' : '−';
  const amount = sign + formatPaisa(txn.amountPaisa);
  const when = formatRelativeDay(txn.createdAt, new Date(), lang);

  return (
    <Pressable
      testID={`txn-${txn.refNo}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m,
        paddingVertical: space.l, borderBottomWidth: separator ? glassTokens.line : 0, borderBottomColor: c.separator,
      }}
    >
      {txn.counterparty.institutionLogoUrl ? (
        // A real mark beats the initials disc.
        <InstitutionLogo size={40} shape="circle" name={txn.counterparty.name} logoUrl={txn.counterparty.institutionLogoUrl} />
      ) : (
        // Initials from the Latin name so the disc reads "AB" in both languages (B15).
        <Avatar name={txn.counterparty.name} size={ROW_AVATAR} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="hl" weight={700} numberOfLines={1}>{name}</Text>
        <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
          {`${when} · ${txnTypeLabel(txn.type, t)}`}
        </Text>
      </View>
      <Text variant="hl" weight={700} color={amountColor}>{urdu ? ltrIsolate(amount) : amount}</Text>
    </Pressable>
  );
}

/** Stack-screen header: a 44 pt round glass back button, the 28/800 title and a sub-line. */
function BackHeader({ testID, title, sub, onBack }: { testID: string; title: string; sub?: string; onBack: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        style={{ width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="h1" weight={800} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 34 }}>{title}</Text>
        {sub ? <Text variant="sub" color={c.ink2} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

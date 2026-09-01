import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, ListRow, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useTransactionsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import type { Txn } from '../../src/api/types';

const FILTERS = [
  { key: 'all', labelKey: 'activity.all' },
  { key: 'bills', labelKey: 'activity.filter.bills', category: 'bills' },
  { key: 'transfer', labelKey: 'activity.filter.transfer', category: 'transfer' },
  { key: 'recharge', labelKey: 'activity.filter.recharge', category: 'recharge' },
  { key: 'savings', labelKey: 'activity.filter.savings', category: 'savings' },
] as const;

const TXN_EMOJI: Record<Txn['type'], string> = {
  p2p: '💸', bank_transfer: '🏦', bill: '🧾', recharge: '📱',
  pocket_deposit: '🐖', pocket_withdraw: '🐖', request_settlement: '🤝',
};

export default function Activity() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const [filter, setFilter] = useState<{ key: string; labelKey: string; category?: string }>(FILTERS[0]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const { data, isFetching, refetch } = useTransactionsQuery({ category: filter.category, cursor });

  const items = data?.items ?? [];

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('activity.title')}</T>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: tokens.space.s, marginBottom: tokens.space.m, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            testID={`filter-${f.key}`}
            onPress={() => { setCursor(undefined); setFilter(f); }}
            style={{
              paddingHorizontal: tokens.space.m, paddingVertical: tokens.space.s,
              borderRadius: tokens.radius.pill,
              backgroundColor: filter.key === f.key ? tokens.color.accent : tokens.color.surface,
            }}
          >
            <T size={tokens.type.caption} color={filter.key === f.key ? tokens.color.bg : tokens.color.text}>{t(f.labelKey)}</T>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        refreshing={isFetching && !cursor}
        onRefresh={() => { setCursor(undefined); refetch(); }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (data?.nextCursor && !isFetching) setCursor(data.nextCursor);
        }}
        ListEmptyComponent={<T center color={tokens.color.textMuted}>{isFetching ? t('common.loading') : t('activity.empty')}</T>}
        renderItem={({ item }) => (
          <ListRow
            testID={`txn-${item.refNo}`}
            onPress={() => router.push({ pathname: '/txn/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
            left={<T size={24}>{TXN_EMOJI[item.type]}</T>}
            title={<T>{urdu && item.counterparty.urduName ? item.counterparty.urduName : item.counterparty.name}</T>}
            subtitle={<Mono size={tokens.type.caption} color={tokens.color.textMuted} weight="400">{new Date(item.createdAt).toLocaleDateString()}</Mono>}
            right={
              <Mono weight="700" color={item.direction === 'in' ? tokens.color.success : tokens.color.text}>
                {(item.direction === 'in' ? '+' : '−') + formatPaisa(item.amountPaisa)}
              </Mono>
            }
          />
        )}
      />
    </Screen>
  );
}

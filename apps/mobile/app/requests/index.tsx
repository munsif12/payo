import React from 'react';
import { FlatList, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, ListRow, PrimaryButton, Spacer, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useRequestsQuery, useApproveRequestMutation, useDeclineRequestMutation } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';

export default function Requests() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const { data, isFetching, refetch } = useRequestsQuery();
  const [approve] = useApproveRequestMutation();
  const [decline] = useDeclineRequestMutation();

  const onApprove = async (id: string) => {
    const action = await approve(id).unwrap();
    holdAction(action);
    router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginVertical: tokens.space.s }}>
        <T size={tokens.type.h1}>{t('requests.title')}</T>
        <PrimaryButtonSmall label={t('requests.new')} onPress={() => router.push('/requests/new')} />
      </Row>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(x) => x.id}
        refreshing={isFetching}
        onRefresh={refetch}
        ListEmptyComponent={<T center color={tokens.color.textMuted}>{t('requests.empty')}</T>}
        renderItem={({ item }) => (
          <ListRow
            testID={`request-${item.id}`}
            left={<T size={24}>{item.direction === 'incoming' ? '📥' : '📤'}</T>}
            title={<T>{urdu && item.counterparty.urduName ? item.counterparty.urduName : item.counterparty.name}</T>}
            subtitle={t(`requests.${item.status}`) + (item.note ? ` · ${item.note}` : '')}
            right={
              <View style={{ alignItems: 'flex-end', gap: tokens.space.s }}>
                <Mono weight="700">{formatPaisa(item.amountPaisa)}</Mono>
                {item.direction === 'incoming' && item.status === 'pending' && (
                  <Row gap={tokens.space.s} rtlAware={false}>
                    <PrimaryButtonSmall label={t('requests.approve')} onPress={() => onApprove(item.id)} testID={`approve-${item.id}`} />
                    <PrimaryButtonSmall label={t('requests.decline')} danger onPress={() => decline(item.id)} testID={`decline-${item.id}`} />
                  </Row>
                )}
              </View>
            }
          />
        )}
      />
    </Screen>
  );
}

function PrimaryButtonSmall({ label, onPress, danger, testID }: { label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  const urdu = useUrdu();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        backgroundColor: danger ? tokens.color.danger : tokens.color.accent,
        borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: 6,
      }}
    >
      <T size={tokens.type.caption} color={tokens.color.bg}>{label}</T>
    </Pressable>
  );
}

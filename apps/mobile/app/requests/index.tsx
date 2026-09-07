import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Plus } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, Text, ListRow, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion/usePressScale';
import { useRequestsQuery, useApproveRequestMutation, useDeclineRequestMutation, useApprovalsQuery } from '../../src/api/client';
import { CardView } from '../../src/components/cards/CardView';
import type { ApprovalsCard, ApprovalItem } from '../../src/components/cards/cardShapes';
import type { ChatCard } from '../../src/voice/useConverse';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import type { RequestDto } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STATUS_COLOR: Record<RequestDto['status'], 'ink2' | 'green' | 'red'> = {
  pending: 'ink2',
  approved: 'green',
  declined: 'red',
};

export default function Requests() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data, isFetching, refetch } = useRequestsQuery();
  // Guardian inbox (spec §1 rule 5) — sends waiting for MY decision. Rendered by
  // the same `approvals` card the assistant shows in chat, so Approve opens the
  // PIN sheet in guardian mode here too and there is only one approval UI.
  const { data: approvals } = useApprovalsQuery();
  const approvalItems: ApprovalItem[] = (approvals?.items ?? []).map((a) => ({
    actionId: a.id,
    payerName: a.payer.name,
    payerPhone: a.payer.phone,
    summary: a.summary,
    amountPaisa: a.amountPaisa,
    riskFlags: a.riskFlags,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
  }));
  const approvalsCard: ApprovalsCard = { kind: 'approvals', items: approvalItems };
  const [approve] = useApproveRequestMutation();
  const [decline] = useDeclineRequestMutation();

  const onApprove = async (id: string) => {
    const action = await approve(id).unwrap();
    holdAction(action);
    router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.l, marginBottom: space.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Pressable testID="requests-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
          </Pressable>
          <Text variant="h1">{t('requests.title')}</Text>
        </View>
        <MiniButton testID="requests-new" label={t('requests.new')} icon={<Plus size={16} color={c.navy} strokeWidth={2.4} />} onPress={() => router.push('/requests/new')} />
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(x) => x.id}
        refreshing={isFetching}
        onRefresh={refetch}
        ListHeaderComponent={
          approvalItems.length
            ? <CardView card={approvalsCard as unknown as ChatCard} />
            : null
        }
        ListEmptyComponent={<Text variant="sub" center style={{ marginTop: space.xxl }}>{t('requests.empty')}</Text>}
        renderItem={({ item }) => (
          <ListRow
            testID={`request-${item.id}`}
            left={
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                {item.direction === 'incoming'
                  ? <ArrowDownLeft size={20} color={c.green} strokeWidth={2.2} />
                  : <ArrowUpRight size={20} color={c.ink2} strokeWidth={2.2} />}
              </View>
            }
            title={urdu && item.counterparty.urduName ? item.counterparty.urduName : item.counterparty.name}
            subtitle={item.note ?? undefined}
            right={
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text variant="hl">{formatPaisa(item.amountPaisa)}</Text>
                {item.direction === 'incoming' && item.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <MiniButton testID={`approve-${item.id}`} label={t('requests.approve')} onPress={() => onApprove(item.id)} />
                    <MiniButton testID={`decline-${item.id}`} label={t('requests.decline')} danger onPress={() => decline(item.id)} />
                  </View>
                ) : (
                  <Pill label={t(`requests.${item.status}`)} bg={c.surface2} color={c[STATUS_COLOR[item.status]]} height={22} />
                )}
              </View>
            }
          />
        )}
      />
    </Screen>
  );
}

function MiniButton({ label, onPress, danger, icon, testID }: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}) {
  const { c } = useTheme();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height: 32, minWidth: 44, paddingHorizontal: 12, borderRadius: 16,
          backgroundColor: danger ? c.redTint : c.amber,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        },
        style,
      ]}
    >
      {icon}
      <Text variant="foot" weight={700} color={danger ? c.red : c.navy} style={{ lineHeight: undefined }}>{label}</Text>
    </AnimatedPressable>
  );
}

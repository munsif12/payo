import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Plus } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, Text, Card, ListRow, Pill, useIsUrdu } from '../../src/ui';
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

  const items = data?.items ?? [];
  const incoming = items.filter((x) => x.direction === 'incoming');
  const outgoing = items.filter((x) => x.direction === 'outgoing');

  const requestRow = (item: RequestDto, isLast: boolean) => (
    <ListRow
      key={item.id}
      testID={`request-${item.id}`}
      separator={!isLast}
      left={
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.direction === 'incoming' ? c.amberTint : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {item.direction === 'incoming'
            ? <ArrowDownLeft size={20} color={c.navy} strokeWidth={2} />
            : <ArrowUpRight size={20} color={c.navy} strokeWidth={2} />}
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
  );

  return (
    <Screen>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.l, marginBottom: space.l }}>
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
          <Pressable testID="requests-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={c.ink} strokeWidth={2} />
          </Pressable>
          <Text variant="h2">{t('requests.title')}</Text>
        </View>
        <HeaderPill testID="requests-new" label={t('requests.new')} onPress={() => router.push('/requests/new')} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={{ gap: space.m, paddingBottom: space.xl }}
      >
        {approvalItems.length ? <CardView card={approvalsCard as unknown as ChatCard} /> : null}

        {incoming.length ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 4 }}>{t('requests.incoming')}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {incoming.map((item, i) => requestRow(item, i === incoming.length - 1))}
            </Card>
          </View>
        ) : null}

        {outgoing.length ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 4 }}>{t('requests.outgoing')}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {outgoing.map((item, i) => requestRow(item, i === outgoing.length - 1))}
            </Card>
          </View>
        ) : null}

        {!approvalItems.length && !items.length ? (
          <Text variant="sub" center style={{ marginTop: space.xxl }}>{t('requests.empty')}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// Requests.dc.html header pill: amber, 36pt tall, "+ Request money".
function HeaderPill({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
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
          height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.amber,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        },
        style,
      ]}
    >
      <Plus size={14} color={c.navy} strokeWidth={2.6} />
      <Text variant="foot" weight={700} color={c.navy} style={{ lineHeight: undefined }}>{label}</Text>
    </AnimatedPressable>
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

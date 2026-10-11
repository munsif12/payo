import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, Text, Card, ListRow, Pill, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion/usePressScale';
import { useRequestsQuery, useApproveRequestMutation, useDeclineRequestMutation, useApprovalsQuery } from '../../src/api/client';
import { CardView } from '../../src/components/cards/CardView';
import type { ApprovalsCard, ApprovalItem } from '../../src/components/cards/cardShapes';
import type { ChatCard } from '../../src/voice/useConverse';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { RequestDto } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Requests — GLASS-SPEC §5 B23: glass rows with cream (people-you-pay) avatars,
// amber "Pay" / glass "Decline" chips on a pending incoming request, tinted
// status pills otherwise, and the amber "Ask someone for money" primary pinned
// under the list with the voice hint.
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
  const rowDir = urdu ? 'row-reverse' : 'row';

  const onApprove = async (id: string) => {
    const action = await approve(id).unwrap();
    holdAction(action);
    router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
  };

  const items = data?.items ?? [];
  const incoming = items.filter((x) => x.direction === 'incoming');
  const outgoing = items.filter((x) => x.direction === 'outgoing');

  const statusPill = (status: RequestDto['status']) => {
    const tint =
      status === 'approved' ? { bg: c.greenTint, color: c.green } :
      status === 'declined' ? { bg: c.redTint, color: c.red } :
      { bg: c.amberTint, color: c.amber };
    return <Pill label={t(`requests.${status}`)} bg={tint.bg} color={tint.color} height={24} />;
  };

  const requestRow = (item: RequestDto, isLast: boolean) => {
    const name = urdu && item.counterparty.urduName ? item.counterparty.urduName : item.counterparty.name;
    const when = formatShortDate(item.createdAt);
    return (
      <ListRow
        key={item.id}
        testID={`request-${item.id}`}
        separator={!isLast}
        left={<Avatar name={name} bg={c.cream} color={c.navy} />}
        title={name}
        subtitle={item.note ? `${item.note} · ${ltrIsolate(when)}` : ltrIsolate(when)}
        right={
          <View style={{ alignItems: urdu ? 'flex-start' : 'flex-end', gap: 6 }}>
            <Text variant="hl" weight={700} style={{ writingDirection: 'ltr' }}>{ltrIsolate(formatPaisa(item.amountPaisa))}</Text>
            {item.direction === 'incoming' && item.status === 'pending' ? (
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                <MiniChip testID={`approve-${item.id}`} label={t('requests.approve')} amber onPress={() => onApprove(item.id)} />
                <MiniChip testID={`decline-${item.id}`} label={t('requests.decline')} onPress={() => decline(item.id)} />
              </View>
            ) : statusPill(item.status)}
          </View>
        }
      />
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="requests-back"
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface,
            borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={22} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" numberOfLines={1}>{t('requests.title')}</Text>
          <Text variant="sub" numberOfLines={1}>{t('requests.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={c.ink2} />}
        contentContainerStyle={{ gap: space.m, paddingBottom: space.l }}
      >
        {approvalItems.length ? <CardView card={approvalsCard as unknown as ChatCard} /> : null}

        {incoming.length ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 6 }}>{t('requests.incoming')}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {incoming.map((item, i) => requestRow(item, i === incoming.length - 1))}
            </Card>
          </View>
        ) : null}

        {outgoing.length ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 6 }}>{t('requests.outgoing')}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {outgoing.map((item, i) => requestRow(item, i === outgoing.length - 1))}
            </Card>
          </View>
        ) : null}

        {!approvalItems.length && !items.length ? (
          <Text variant="sub" center style={{ marginTop: space.xxl }}>{t('requests.empty')}</Text>
        ) : null}
      </ScrollView>

      {/* Pinned under the list so "Ask someone for money" is always reachable. */}
      <View style={{ gap: space.m, paddingTop: space.m, paddingBottom: space.l }}>
        <Button testID="requests-new" label={t('requests.ask')} onPress={() => router.push('/requests/new')} />
        <Text variant="foot" color={c.ink3} center>{t('requests.askHint')}</Text>
      </View>
    </Screen>
  );
}

// GLASS-SPEC §2 chip at 32 pt: amber (navy text) for Pay, glass (fill + line,
// cream text) for Decline.
function MiniChip({ label, onPress, amber, testID }: {
  label: string;
  onPress: () => void;
  amber?: boolean;
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
          height: 32, minWidth: touch.min, paddingHorizontal: 12, borderRadius: 16,
          backgroundColor: amber ? c.amber : c.surface,
          borderWidth: glassTokens.line, borderColor: amber ? c.amber : c.separator,
          alignItems: 'center', justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text variant="foot" weight={700} color={amber ? c.onAmber : c.ink} style={{ lineHeight: undefined }}>{label}</Text>
    </AnimatedPressable>
  );
}

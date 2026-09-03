import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Download, FileText } from 'lucide-react-native';
import { Text, Card as NewCard, Button, Pill, useIsUrdu } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { space, radius } from '../../theme/tokens';
import { usePressScale } from '../../motion/usePressScale';
import { holdAction, useActionDone } from '../../store/pendingActionHolder';
import { formatPaisa } from '../../lib/money';
import { ltrIsolate } from '../../lib/bidi';
import type { PendingAction } from '../../api/types';
import type { ChatCard } from '../../voice/useConverse';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  card: ChatCard;
  onChipTap?: (text: string) => void;
}

export function CardView({ card, onChipTap }: Props) {
  switch (card.kind) {
    case 'confirmation': return <ConfirmationCardView card={card} />;
    case 'balance': return <BalanceCardView card={card} />;
    case 'contact_chips': return <ChipsCardView card={card} onChipTap={onChipTap} />;
    case 'bill': return <BillCardView card={card} />;
    case 'pocket': return <PocketCardView card={card} />;
    case 'statement': return <StatementCardView card={card} />;
    case 'transactions': return <TxnsCardView card={card} />;
    case 'success': return <SuccessCardView card={card} />;
    default: return null;
  }
}

function ConfirmationCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const summary = card.summary as { en: string; ur: string };
  const done = useActionDone(String(card.actionId));

  const onConfirm = () => {
    const action: PendingAction = {
      id: String(card.actionId), kind: 'ai', amountPaisa: Number(card.amountPaisa),
      feePaisa: Number(card.feePaisa ?? 0), summary,
      lines: (card.lines as PendingAction['lines']) ?? [],
      requiresPin: Boolean(card.requiresPin), expiresAt: String(card.expiresAt), status: 'pending',
    };
    holdAction(action);
    router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
  };

  return (
    <NewCard style={{ marginTop: space.s, borderWidth: 1, borderColor: c.amber, gap: space.m, alignItems: 'center' }}>
      <Text variant="hl" center>{urdu ? summary.ur : summary.en}</Text>
      <Text variant="money">{formatPaisa(Number(card.amountPaisa))}</Text>
      <Button
        testID={done ? 'chat-confirm-done' : 'chat-confirm'}
        variant={done ? 'secondary' : 'primary'}
        label={done ? t('confirm.completed') : t('common.confirm')}
        onPress={done ? () => {} : onConfirm}
        disabled={done}
        style={{ alignSelf: 'stretch' }}
      />
    </NewCard>
  );
}

function BalanceCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.xs }}>
      <Text variant="cap">{t('home.balance')}</Text>
      <Text variant="money">{ltrIsolate(formatPaisa(Number(card.balancePaisa)))}</Text>
    </NewCard>
  );
}

function ChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const prompt = card.prompt as { en: string; ur: string };
  const contacts = card.contacts as { contactId: string; name: string; urduName?: string; detail: string }[];
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="foot">{urdu ? prompt.ur : prompt.en}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        {contacts.map((ctc) => (
          <ContactChip
            key={ctc.contactId}
            testID={`chip-${ctc.contactId}`}
            label={urdu && ctc.urduName ? ctc.urduName : ctc.name}
            detail={ctc.detail}
            onPress={() => onChipTap?.(urdu && ctc.urduName ? ctc.urduName : ctc.name)}
          />
        ))}
      </View>
    </View>
  );
}

function ContactChip({ label, detail, onPress, testID }: {
  label: string;
  detail: string;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          backgroundColor: c.surface2, borderRadius: radius.pill,
          borderWidth: 1, borderColor: c.amber,
          paddingHorizontal: space.m, paddingVertical: space.s,
        },
        style,
      ]}
    >
      <Text variant="sub" weight={600}>{label}</Text>
      <Text variant="foot">{detail}</Text>
    </AnimatedPressable>
  );
}

function BillCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.xs }}>
      <Text variant="hl" center>{String(card.biller)} · {String(card.consumerName)}</Text>
      <Text variant="money" style={{ fontSize: 32, lineHeight: 38 }}>{ltrIsolate(formatPaisa(Number(card.amountPaisa)))}</Text>
      <Text variant="foot" center>
        {t('bills.month')} {String(card.month)} · {t('bills.dueDate')} {ltrIsolate(String(card.dueDate).slice(0, 10))}
      </Text>
    </NewCard>
  );
}

function PocketCardView({ card }: { card: ChatCard }) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const goal = card.goalPaisa ? Number(card.goalPaisa) : 0;
  const pct = goal ? Math.min(1, Number(card.balancePaisa) / goal) : 0;
  return (
    <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.xs }}>
      <Text variant="hl" center>{String(card.emoji)} {urdu && card.urduName ? String(card.urduName) : String(card.name)}</Text>
      <Text variant="money" style={{ fontSize: 30, lineHeight: 36 }}>{ltrIsolate(formatPaisa(Number(card.balancePaisa)))}</Text>
      {goal ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: 'hidden', marginTop: space.s, alignSelf: 'stretch' }}>
          <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: c.amber }} />
        </View>
      ) : null}
    </NewCard>
  );
}

function StatementCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const period = card.period as { en: string; ur: string };
  return (
    <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.s }}>
      <FileText size={22} color={c.ink2} strokeWidth={2} />
      <Text variant="hl" center>{urdu ? period.ur : period.en}</Text>
      <Text variant="foot" center>
        {ltrIsolate(`${t('statements.moneyIn')} ${formatPaisa(Number(card.totalInPaisa))} · ${t('statements.moneyOut')} ${formatPaisa(Number(card.totalOutPaisa))}`)}
      </Text>
      <StatementDownload statementId={String(card.statementId)} />
    </NewCard>
  );
}

// statementId is accepted for context/testability but unused — StatementCardView
// only deep-links to the Statements list, matching the pre-restyle behaviour.
function StatementDownload({ statementId: _statementId }: { statementId: string }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Button
      testID="chat-statement-download"
      label={t('statements.download')}
      icon={<Download size={20} color={c.navy} strokeWidth={2} />}
      onPress={() => router.push('/statements')}
      style={{ alignSelf: 'stretch' }}
    />
  );
}

function TxnsCardView({ card }: { card: ChatCard }) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const items = (card.items as { id: string; direction: string; amountPaisa: number; counterparty: { name: string; urduName?: string }; createdAt: string }[]).slice(0, 5);
  return (
    <NewCard style={{ marginTop: space.s, gap: space.s }}>
      {items.map((txn) => (
        <View key={txn.id} style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
          <Text variant="foot">{urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name}</Text>
          <Text variant="foot" color={txn.direction === 'in' ? c.green : c.ink}>
            {ltrIsolate((txn.direction === 'in' ? '+' : '−') + formatPaisa(txn.amountPaisa))}
          </Text>
        </View>
      ))}
    </NewCard>
  );
}

function SuccessCardView({ card }: { card: ChatCard }) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const title = card.title as { en: string; ur: string };
  return (
    <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.s }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' }}>
        <Check size={22} color={c.green} strokeWidth={3} />
      </View>
      <Text variant="hl" center>{urdu ? title.ur : title.en}</Text>
      <Text variant="money" style={{ fontSize: 28, lineHeight: 34 }}>{formatPaisa(Number(card.amountPaisa))}</Text>
      <Pill label={String(card.refNo)} bg={c.surface2} color={c.ink2} />
    </NewCard>
  );
}

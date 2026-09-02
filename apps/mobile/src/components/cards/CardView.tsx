import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { tokens } from '../../theme/tokens';
import { T, Mono, MoneyText, Card, Row, Spacer, useUrdu } from '../ui';
import { holdAction, useActionDone } from '../../store/pendingActionHolder';
import type { PendingAction } from '../../api/types';
import type { ChatCard } from '../../voice/useConverse';

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
  const urdu = useUrdu();
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
    <Card style={{ marginTop: tokens.space.s, borderWidth: 1, borderColor: tokens.color.accent }}>
      <T center>{urdu ? summary.ur : summary.en}</T>
      <MoneyText paisa={Number(card.amountPaisa)} size={32} center color={tokens.color.accent} />
      <Spacer h={tokens.space.s} />
      <Pressable
        testID={done ? 'chat-confirm-done' : 'chat-confirm'}
        onPress={done ? undefined : onConfirm}
        disabled={done}
        style={{
          minHeight: tokens.touch.primary, borderRadius: tokens.radius.button,
          backgroundColor: done ? tokens.color.surfaceRaised : tokens.color.accent,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <T color={done ? tokens.color.textMuted : tokens.color.bg}>
          {done ? t('confirm.completed') : t('common.confirm')}
        </T>
      </Pressable>
    </Card>
  );
}

function BalanceCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <Card style={{ marginTop: tokens.space.s, alignItems: 'center' }}>
      <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('home.balance')}</T>
      <MoneyText paisa={Number(card.balancePaisa)} size={36} color={tokens.color.accent} />
    </Card>
  );
}

function ChipsCardView({ card, onChipTap }: Props) {
  const urdu = useUrdu();
  const prompt = card.prompt as { en: string; ur: string };
  const contacts = card.contacts as { contactId: string; name: string; urduName?: string; detail: string }[];
  return (
    <View style={{ marginTop: tokens.space.s }}>
      <T size={tokens.type.caption} color={tokens.color.textMuted}>{urdu ? prompt.ur : prompt.en}</T>
      <Row style={{ flexWrap: 'wrap', marginTop: tokens.space.s }} gap={tokens.space.s}>
        {contacts.map(c => (
          <Pressable
            key={c.contactId}
            testID={`chip-${c.contactId}`}
            onPress={() => onChipTap?.(urdu && c.urduName ? c.urduName : c.name)}
            style={{
              backgroundColor: tokens.color.surfaceRaised, borderRadius: tokens.radius.pill,
              borderWidth: 1, borderColor: tokens.color.accent,
              paddingHorizontal: tokens.space.m, paddingVertical: tokens.space.s,
            }}
          >
            <T>{urdu && c.urduName ? c.urduName : c.name}</T>
            <Mono size={12} color={tokens.color.textMuted} weight="400">{c.detail}</Mono>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

function BillCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <Card style={{ marginTop: tokens.space.s }}>
      <T center>{String(card.biller)} · {String(card.consumerName)}</T>
      <MoneyText paisa={Number(card.amountPaisa)} size={32} center color={tokens.color.accent} />
      <Mono size={tokens.type.caption} color={tokens.color.textMuted} center>
        {t('bills.month')} {String(card.month)} · {t('bills.dueDate')} {String(card.dueDate).slice(0, 10)}
      </Mono>
    </Card>
  );
}

function PocketCardView({ card }: { card: ChatCard }) {
  const urdu = useUrdu();
  const goal = card.goalPaisa ? Number(card.goalPaisa) : 0;
  const pct = goal ? Math.min(1, Number(card.balancePaisa) / goal) : 0;
  return (
    <Card style={{ marginTop: tokens.space.s }}>
      <T center>{String(card.emoji)} {urdu && card.urduName ? String(card.urduName) : String(card.name)}</T>
      <MoneyText paisa={Number(card.balancePaisa)} size={30} center color={tokens.color.accent} />
      {goal ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: tokens.color.surfaceRaised, overflow: 'hidden', marginTop: tokens.space.s }}>
          <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: tokens.color.accent }} />
        </View>
      ) : null}
    </Card>
  );
}

function StatementCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const period = card.period as { en: string; ur: string };
  return (
    <Card style={{ marginTop: tokens.space.s }}>
      <T center>📄 {urdu ? period.ur : period.en}</T>
      <Mono size={tokens.type.caption} color={tokens.color.textMuted} center>
        {`${t('statements.moneyIn')} ₨${(Number(card.totalInPaisa) / 100).toLocaleString()} · ${t('statements.moneyOut')} ₨${(Number(card.totalOutPaisa) / 100).toLocaleString()}`}
      </Mono>
      <Spacer h={tokens.space.s} />
      <StatementDownload statementId={String(card.statementId)} />
    </Card>
  );
}

function StatementDownload({ statementId }: { statementId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      testID="chat-statement-download"
      onPress={() => router.push('/statements')}
      style={{
        minHeight: tokens.touch.primary, borderRadius: tokens.radius.button,
        backgroundColor: tokens.color.accent, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <T color={tokens.color.bg}>{t('statements.download')}</T>
    </Pressable>
  );
}

function TxnsCardView({ card }: { card: ChatCard }) {
  const urdu = useUrdu();
  const items = (card.items as { id: string; direction: string; amountPaisa: number; counterparty: { name: string; urduName?: string }; createdAt: string }[]).slice(0, 5);
  return (
    <Card style={{ marginTop: tokens.space.s, gap: tokens.space.s }}>
      {items.map(txn => (
        <Row key={txn.id} style={{ justifyContent: 'space-between' }}>
          <T size={tokens.type.caption}>{urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name}</T>
          <Mono size={tokens.type.caption} color={txn.direction === 'in' ? tokens.color.success : tokens.color.text}>
            {(txn.direction === 'in' ? '+' : '−') + '₨' + (txn.amountPaisa / 100).toLocaleString()}
          </Mono>
        </Row>
      ))}
    </Card>
  );
}

function SuccessCardView({ card }: { card: ChatCard }) {
  const urdu = useUrdu();
  const title = card.title as { en: string; ur: string };
  return (
    <Card style={{ marginTop: tokens.space.s, alignItems: 'center' }}>
      <T size={30}>✅</T>
      <T center>{urdu ? title.ur : title.en}</T>
      <MoneyText paisa={Number(card.amountPaisa)} size={28} center color={tokens.color.accent} />
      <Mono size={12} color={tokens.color.textMuted}>{String(card.refNo)}</Mono>
    </Card>
  );
}

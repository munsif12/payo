import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Download, FileText } from 'lucide-react-native';
import { Text, Card as NewCard, Button, Input, Pill, Avatar, useIsUrdu } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { space, radius } from '../../theme/tokens';
import { usePressScale } from '../../motion/usePressScale';
import { useActionDone, markActionDone } from '../../store/pendingActionHolder';
import { usePinSheet } from '../../pin/usePinSheet';
import { useCreateRecipientMutation, useCreateSavedBillerMutation, useExecuteActionMutation, apiErr } from '../../api/client';
import { formatPaisa } from '../../lib/money';
import { ltrIsolate } from '../../lib/bidi';
import { maskIdentifier } from '../../lib/mask';
import i18n from '../../i18n';
import type { PendingAction, RecipientSuggestion, BillerSuggestion } from '../../api/types';
import type { ChatCard, ChatMessage } from '../../voice/useConverse';
import type {
  RecipientCard as RecipientCardShape,
  RecipientChip, InstitutionChip, BillerChip, SavePromptCard as SavePromptCardShape,
} from './cardShapes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  card: ChatCard;
  onChipTap?: (text: string) => void;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
}

export function CardView({ card, onChipTap, onAppendLocal }: Props) {
  switch (card.kind) {
    case 'confirmation': return <ConfirmationCardView card={card} onAppendLocal={onAppendLocal} />;
    case 'balance': return <BalanceCardView card={card} />;
    case 'bill': return <BillCardView card={card} />;
    case 'pocket': return <PocketCardView card={card} />;
    case 'statement': return <StatementCardView card={card} />;
    case 'transactions': return <TxnsCardView card={card} />;
    case 'success': return <SuccessCardView card={card} />;
    case 'save_prompt': return <SavePromptCardView card={card} />;
    case 'recipient': return <RecipientCardView card={card} onChipTap={onChipTap} />;
    case 'recipient_chips': return <RecipientChipsCardView card={card} onChipTap={onChipTap} />;
    case 'institution_chips': return <InstitutionChipsCardView card={card} onChipTap={onChipTap} />;
    case 'biller_chips': return <BillerChipsCardView card={card} onChipTap={onChipTap} />;
    default: return null;
  }
}

// Builds the local success + (optional) save_prompt cards appended after a
// chat confirmation executes — shared by the PIN-sheet and no-PIN paths.
// save_prompt's `prompt` is required by the cards.py contract, so it's built
// here in both languages regardless of the current UI language.
function buildResultCards(
  summary: { en: string; ur: string },
  transaction: { refNo: string; amountPaisa: number },
  recipientSuggestion?: RecipientSuggestion,
  billerSuggestion?: BillerSuggestion,
): ChatCard[] {
  const cards: ChatCard[] = [
    { kind: 'success', title: summary, refNo: transaction.refNo, amountPaisa: transaction.amountPaisa },
  ];
  if (recipientSuggestion && !recipientSuggestion.alreadySaved) {
    const savePrompt: SavePromptCardShape = {
      kind: 'save_prompt',
      target: 'recipient',
      institutionId: recipientSuggestion.institutionId,
      identifier: recipientSuggestion.identifier,
      title: recipientSuggestion.title,
      prompt: {
        en: i18n.t('save.recipientPrompt', { lng: 'en', name: recipientSuggestion.title }),
        ur: i18n.t('save.recipientPrompt', { lng: 'ur', name: recipientSuggestion.title }),
      },
    };
    cards.push(savePrompt as unknown as ChatCard);
  } else if (billerSuggestion && !billerSuggestion.alreadySaved) {
    const savePrompt: SavePromptCardShape = {
      kind: 'save_prompt',
      target: 'biller',
      billerId: billerSuggestion.billerId,
      consumerNo: billerSuggestion.consumerNo,
      consumerName: billerSuggestion.consumerName,
      prompt: {
        en: i18n.t('save.billerPrompt', { lng: 'en', name: billerSuggestion.consumerName }),
        ur: i18n.t('save.billerPrompt', { lng: 'ur', name: billerSuggestion.consumerName }),
      },
    };
    cards.push(savePrompt as unknown as ChatCard);
  }
  return cards;
}

function ConfirmationCardView({ card, onAppendLocal }: {
  card: ChatCard;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const { openPinSheet } = usePinSheet();
  const [execute] = useExecuteActionMutation();
  const summary = card.summary as { en: string; ur: string };
  const done = useActionDone(String(card.actionId));
  const [confirming, setConfirming] = useState(false);

  const onConfirm = async () => {
    if (confirming || done) return;
    const action: PendingAction = {
      id: String(card.actionId), kind: 'ai', amountPaisa: Number(card.amountPaisa),
      feePaisa: Number(card.feePaisa ?? 0), summary,
      lines: (card.lines as PendingAction['lines']) ?? [],
      requiresPin: Boolean(card.requiresPin), expiresAt: String(card.expiresAt), status: 'pending',
    };
    setConfirming(true);
    try {
      if (!action.requiresPin) {
        // No PIN needed — execute directly, same as confirm/[actionId] does,
        // instead of opening a sheet nobody needs to type into. This call has
        // no sheet to surface a failure inside, so an error (ACTION_GONE,
        // INSUFFICIENT_FUNDS, ...) is rendered as an error bubble here.
        try {
          const { transaction, recipientSuggestion, billerSuggestion } = await execute({ id: action.id }).unwrap();
          markActionDone(action.id);
          onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(summary, transaction, recipientSuggestion, billerSuggestion) });
        } catch (e) {
          onAppendLocal?.({ role: 'error', text: apiErr(e).message, cards: [] });
        }
        return;
      }
      const { transaction, recipientSuggestion, billerSuggestion } = await openPinSheet(action);
      onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(summary, transaction, recipientSuggestion, billerSuggestion) });
    } catch {
      // openPinSheet rejects with 'cancelled' (sheet dismissed/swiped away) or
      // 'busy' (a sheet is already open for another action) — an execute
      // failure while the sheet IS open (INVALID_PIN/PIN_LOCKED) is handled
      // inside the sheet itself and keeps it open, so nothing to render here
      // for either case.
    } finally {
      setConfirming(false);
    }
  };

  return (
    <NewCard style={{ marginTop: space.s, borderWidth: 1, borderColor: undefined, gap: space.m, alignItems: 'center' }}>
      <Text variant="hl" center>{urdu ? summary.ur : summary.en}</Text>
      <Text variant="money">{formatPaisa(Number(card.amountPaisa))}</Text>
      <Button
        testID={done ? 'chat-confirm-done' : 'chat-confirm'}
        variant={done ? 'secondary' : 'primary'}
        label={done ? t('confirm.completed') : t('common.confirm')}
        onPress={onConfirm}
        disabled={done}
        loading={confirming}
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

function ChipRow({ label, detail, onPress, testID }: {
  label: string;
  detail?: string;
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
      {detail ? <Text variant="foot">{detail}</Text> : null}
    </AnimatedPressable>
  );
}

function RecipientChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const prompt = card.prompt as { en: string; ur: string };
  const recipients = (card.recipients ?? []) as RecipientChip[];
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="foot">{urdu ? prompt.ur : prompt.en}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        {recipients.map((r) => (
          <ChipRow
            key={r.recipientId}
            testID={`chip-recipient-${r.recipientId}`}
            label={r.nickname}
            detail={`${r.title} · ${r.institutionName} · ${maskIdentifier(r.identifier)}`}
            onPress={() => onChipTap?.(r.nickname)}
          />
        ))}
      </View>
    </View>
  );
}

function InstitutionChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const prompt = card.prompt as { en: string; ur: string };
  const institutions = (card.institutions ?? []) as InstitutionChip[];
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="foot">{urdu ? prompt.ur : prompt.en}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        {institutions.map((inst) => (
          <ChipRow
            key={inst.institutionId}
            testID={`chip-institution-${inst.institutionId}`}
            label={urdu && inst.urduName ? inst.urduName : inst.name}
            onPress={() => onChipTap?.(inst.name)}
          />
        ))}
      </View>
    </View>
  );
}

function BillerChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const prompt = card.prompt as { en: string; ur: string };
  const billers = (card.billers ?? []) as BillerChip[];
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="foot">{urdu ? prompt.ur : prompt.en}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        {billers.map((b) => {
          const key = b.savedBillerId ?? b.billerId;
          const label = urdu && b.urduName ? b.urduName : b.name;
          return (
            <ChipRow
              key={key}
              testID={`chip-biller-${key}`}
              label={label}
              detail={b.consumerNo ? ltrIsolate(b.consumerNo) : undefined}
              onPress={() => onChipTap?.(label)}
            />
          );
        })}
      </View>
    </View>
  );
}

function RecipientCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const c = card as unknown as RecipientCardShape;
  const institution = c.institution;

  return (
    <NewCard style={{ marginTop: space.s, gap: space.m, alignItems: 'center' }}>
      <Avatar name={c.title} size={48} />
      <Text variant="hl" center>{c.title}</Text>
      <Text variant="foot" center>
        {urdu && institution?.urduName ? institution.urduName : institution?.name} · {ltrIsolate(maskIdentifier(c.identifier))}
      </Text>
      <Text variant="sub" center>{urdu ? c.prompt.ur : c.prompt.en}</Text>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <ChipRow testID="chip-recipient-yes" label={t('chips.yesContinue')} onPress={() => onChipTap?.(t('chips.yesContinue'))} />
        <ChipRow testID="chip-recipient-no" label={t('chips.no')} onPress={() => onChipTap?.(t('chips.no'))} />
      </View>
    </NewCard>
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

function SavePromptCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const shape = card as unknown as SavePromptCardShape;
  const target = shape.target;
  const defaultNickname = target === 'recipient' ? String(shape.title ?? '') : String(shape.consumerName ?? '');
  const [nickname, setNickname] = useState(defaultNickname);
  const [saved, setSaved] = useState(Boolean((card as { alreadySaved?: boolean }).alreadySaved));
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createRecipient, { isLoading: savingRecipient }] = useCreateRecipientMutation();
  const [createSavedBiller, { isLoading: savingBiller }] = useCreateSavedBillerMutation();
  const saving = savingRecipient || savingBiller;

  // Prefer the card's own bilingual prompt (cards.py SavePromptCard.prompt is
  // required — every producer, ours included, sends it); recompute only as a
  // defensive fallback for a malformed/older card.
  const prompt = shape.prompt
    ? (urdu ? shape.prompt.ur : shape.prompt.en)
    : (target === 'recipient'
        ? t('save.recipientPrompt', { name: defaultNickname })
        : t('save.billerPrompt', { name: defaultNickname }));

  const onSave = async () => {
    if (!nickname.trim()) return;
    setError(null);
    try {
      if (target === 'recipient') {
        await createRecipient({
          nickname: nickname.trim(),
          institutionId: String(shape.institutionId),
          identifier: String(shape.identifier),
        }).unwrap();
      } else {
        await createSavedBiller({
          nickname: nickname.trim(),
          billerId: String(shape.billerId),
          consumerNo: String(shape.consumerNo),
        }).unwrap();
      }
      setSaved(true);
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  if (saved) {
    return (
      <NewCard style={{ marginTop: space.s, alignItems: 'center', gap: space.s }}>
        <View testID="save-prompt-saved">
          <Pill label={t('save.saved')} bg={c.greenTint} color={c.green} />
        </View>
      </NewCard>
    );
  }

  if (dismissed) return null;

  return (
    <NewCard style={{ marginTop: space.s, gap: space.m }}>
      <Text variant="sub" center>{prompt}</Text>
      <Input
        testID="save-prompt-nickname"
        placeholder={t('save.nickname')}
        value={nickname}
        onChangeText={setNickname}
      />
      {error ? <Text variant="foot" color={c.red} center>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Button
          testID="save-prompt-save"
          label={t('save.save')}
          onPress={onSave}
          loading={saving}
          disabled={!nickname.trim()}
          style={{ flex: 1 }}
        />
        <Button
          testID="save-prompt-not-now"
          variant="ghost"
          label={t('save.notNow')}
          onPress={() => setDismissed(true)}
          style={{ flex: 1 }}
        />
      </View>
    </NewCard>
  );
}

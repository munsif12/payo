import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft, ArrowDownRight, ArrowUpRight, BellRing, Check, ChevronRight, Clock, Download,
  FileText, QrCode as QrIcon, Settings as SettingsIcon, Share2, ShieldAlert, ShieldCheck,
  Sparkles, TrendingUp, Users, Zap, type LucideIcon,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text, Card as NewCard, Button, Input, Pill, Avatar, InstitutionLogo, ListRow, useIsUrdu } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { space, radius, touch } from '../../theme/tokens';
import { usePressScale } from '../../motion/usePressScale';
import { IconSwap } from '../../motion/IconSwap';
import { useActionDone, markActionDone } from '../../store/pendingActionHolder';
import { usePinSheet } from '../../pin/usePinSheet';
import {
  useCreateRecipientMutation, useCreateSavedBillerMutation, useExecuteActionMutation,
  useCheckInActionMutation, useRemindGuardianMutation, useActionQuery, useMeQuery,
  useApproveApprovalMutation, useDeclineApprovalMutation, apiErr,
} from '../../api/client';
import { formatPaisa } from '../../lib/money';
import { ltrIsolate } from '../../lib/bidi';
import { maskIdentifier } from '../../lib/mask';
import i18n, { applyLanguage } from '../../i18n';
import type { PendingAction, CardSummary, RecipientSuggestion, BillerSuggestion } from '../../api/types';
import type { ChatCard, ChatMessage } from '../../voice/useConverse';
import { useOutcomeSpeech } from '../../voice/OutcomeSpeechProvider';
import {
  claimAutoOpenPin, releaseAutoOpen, buildResultCards, showConfirmationAmount,
} from './confirmationPolicy';
import { guardianPendingLine, approvalOutcome, guardianCopy, type ApprovalOutcome } from './guardianPolicy';
import type {
  RecipientCard as RecipientCardShape,
  RecipientChip, InstitutionChip, BillerChip, SavePromptCard as SavePromptCardShape,
  ReceiptCard as ReceiptCardShape, SpendingCard as SpendingCardShape,
  AccountCard as AccountCardShape, ProfileCard as ProfileCardShape,
  HelpCard as HelpCardShape, CardCard as CardCardShape,
  StatementsCard as StatementsCardShape, RecipientsCard as RecipientsCardShape,
  BillsCard as BillsCardShape, BillersCard as BillersCardShape,
  TelcoChipsCard as TelcoChipsCardShape, PocketsCard as PocketsCardShape,
  RequestCard as RequestCardShape, RequestsCard as RequestsCardShape,
  QrCard as QrCardShape, RequestItem, Bilingual,
  CheckInCard as CheckInCardShape, WaitingApprovalCard as WaitingApprovalCardShape,
  ApprovalsCard as ApprovalsCardShape, ApprovalItem as ApprovalItemShape,
  DigestCard as DigestCardShape, GuardianCard as GuardianCardShape,
} from './cardShapes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Cards.dc.html geometry. Every chat card is the shared Card shell (radius 20 +
// the card shadow token) with the artboard's 12/14 padding — not the 20pt
// screen padding a full-width card gets, because a card in the conversation is
// already inset to 86% of the list by the bubble around it.
const CARD_PAD_V = 12;
const CARD_PAD_H = 14;
/** Receipt avatar / check-in shield / waiting clock disc. */
const ICON_CIRCLE = 44;
/** Icon drawn inside ICON_CIRCLE. */
const ICON_GLYPH = 22;
/** Recipient + approval row avatar (Cards/HomeConversation artboards). */
const ROW_LOGO = 36;
/** InstitutionLogo only offers 24 / 32 / 40 (its type is owned outside this
 *  phase), so a hosted mark renders at the nearest supported size: 40 where the
 *  artboard draws a 44pt disc, 32 where it draws 36. The initials Avatar — the
 *  fallback, and what the artboards actually show — uses the exact size. */
const LOGO_CARD = 40;
const LOGO_ROW = 32;
/** Spending bar track/fill height. */
const BAR_H = 6;
/** Cards.dc.html row/label size that sits between `sub` (15) and `foot` (13). */
const BODY_14 = 14;
/** Cards.dc.html footnote (expiry, fee/total line). */
const FOOT_12 = 12;

/** The white card every chat card is drawn on (Cards.dc.html). */
function CardShell({ children, style }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <NewCard
      padding={0}
      style={[{ marginTop: space.s, paddingVertical: CARD_PAD_V, paddingHorizontal: CARD_PAD_H }, style]}
    >
      {children}
    </NewCard>
  );
}

/** Receipt details, as the artboard's two-column grid: label left in ink2,
 *  value right in ink, 13pt, 6pt gutters, no separators. */
function DetailGrid({ rows }: { rows: [string, string][] }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{ gap: 6 }}>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: space.s }}
        >
          <Text variant="foot" color={c.ink2}>{label}</Text>
          <Text variant="foot" color={c.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** The 18pt chevron the Cards artboard puts on a tappable row. */
function RowChevron() {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <ChevronRight
      size={18}
      color={c.ink3}
      strokeWidth={2}
      style={urdu ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
}

interface Props {
  card: ChatCard;
  onChipTap?: (text: string) => void;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  /** False for a message restored from persisted history — a `confirmation`
   *  with autoOpenPin must NOT re-open the PIN sheet for an action the user
   *  saw in an earlier session. Live SSE messages leave it undefined (= live). */
  live?: boolean;
}

export function CardView({ card, onChipTap, onAppendLocal, live }: Props) {
  switch (card.kind) {
    case 'confirmation': return <ConfirmationCardView card={card} onAppendLocal={onAppendLocal} live={live} />;
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
    case 'receipt': return <ReceiptCardView card={card} />;
    case 'spending': return <SpendingCardView card={card} />;
    case 'account': return <AccountCardView card={card} />;
    case 'profile': return <ProfileCardView card={card} />;
    case 'help': return <HelpCardView card={card} onChipTap={onChipTap} />;
    case 'card': return <CardCardView card={card} />;
    case 'statements': return <StatementsCardView card={card} />;
    case 'recipients': return <RecipientsCardView card={card} onChipTap={onChipTap} />;
    case 'bills': return <BillsCardView card={card} onChipTap={onChipTap} />;
    case 'billers': return <BillersCardView card={card} onChipTap={onChipTap} />;
    case 'telco_chips': return <TelcoChipsCardView card={card} onChipTap={onChipTap} />;
    case 'pockets': return <PocketsCardView card={card} onChipTap={onChipTap} />;
    case 'request': return <RequestCardView card={card} onChipTap={onChipTap} />;
    case 'requests': return <RequestsCardView card={card} onChipTap={onChipTap} />;
    case 'qr': return <QrCardView card={card} />;
    case 'check_in': return <CheckInCardView card={card} onAppendLocal={onAppendLocal} live={live} />;
    case 'waiting_approval': return <WaitingApprovalCardView card={card} onAppendLocal={onAppendLocal} live={live} />;
    case 'approvals': return <ApprovalsCardView card={card} />;
    case 'digest': return <DigestCardView card={card} onChipTap={onChipTap} />;
    case 'guardian': return <GuardianCardView card={card} />;
    default: return null;
  }
}

function ConfirmationCardView({ card, onAppendLocal, live }: {
  card: ChatCard;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  live?: boolean;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const { openPinSheet } = usePinSheet();
  const { speak } = useOutcomeSpeech();
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
          const res = await execute({ id: action.id }).unwrap();
          markActionDone(action.id);
          onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(summary, res, res.recipientSuggestion, res.billerSuggestion) });
          // F2: the cards appear silently otherwise. Spoken for the no-PIN path
          // too — the outcome is the same one, it just needed no PIN to reach.
          speak(res, action);
        } catch (e) {
          onAppendLocal?.({ role: 'error', text: apiErr(e).message, cards: [] });
        }
        return;
      }
      const res = await openPinSheet(action);
      onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(summary, res, res.recipientSuggestion, res.billerSuggestion) });
      speak(res, action);
    } catch (e) {
      // openPinSheet rejects with 'cancelled' (sheet dismissed/swiped away) or
      // 'busy' (a sheet is already open for another action) — an execute
      // failure while the sheet IS open (INVALID_PIN/PIN_LOCKED) is handled
      // inside the sheet itself and keeps it open, so nothing to render here
      // for either case.
      //
      // 'busy' means no sheet was ever shown for THIS card, so the auto-open
      // claim taken below was spent on nothing — hand it back so the card can
      // still self-open once the other sheet is out of the way.
      if ((e as Error)?.message === 'busy') releaseAutoOpen(action.id);
    } finally {
      setConfirming(false);
    }
  };

  // autoOpenPin (cards.py default true, so `undefined` also means "open"):
  // the sheet opens by itself the first time this card mounts from the live
  // stream. onConfirm is reused verbatim, so cancelling leaves the card exactly
  // as it is — Confirm still works.
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  useEffect(() => {
    const open = claimAutoOpenPin(String(card.actionId), {
      autoOpenPin: card.autoOpenPin as boolean | undefined,
      requiresPin: Boolean(card.requiresPin),
      live: live !== false,
      done,
    });
    if (!open) return;
    onConfirmRef.current();
    // Deliberately depends only on the action's identity: a re-render (or a
    // cancelled sheet flipping `confirming`) must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.actionId]);

  // HomeConversation.dc.html confirmation card: centred summary in ink2, the
  // amount at 32/800, the fee/total foot, then the amber CTA.
  const amountPaisa = Number(card.amountPaisa);
  const feePaisa = Number(card.feePaisa ?? 0);
  const showAmount = showConfirmationAmount(amountPaisa);
  const feeLine = `${t('common.fee')} ${formatPaisa(feePaisa)} · ${t('confirm.total')} ${formatPaisa(amountPaisa + feePaisa)}`;

  return (
    <CardShell style={{ alignItems: 'center' }}>
      <Text variant="foot" color={c.ink2} center>{urdu ? summary.ur : summary.en}</Text>
      {showAmount ? (
        <>
          <Text variant="money" style={{ fontSize: 32, lineHeight: 38, marginTop: 6, marginBottom: 2 }}>
            {ltrIsolate(formatPaisa(amountPaisa))}
          </Text>
          <Text variant="foot" center style={{ fontSize: FOOT_12, lineHeight: 16 }}>{ltrIsolate(feeLine)}</Text>
        </>
      ) : null}
      <Button
        testID={done ? 'chat-confirm-done' : 'chat-confirm'}
        variant={done ? 'secondary' : 'primary'}
        label={done ? t('confirm.completed') : card.requiresPin ? t('confirm.confirmWithPin') : t('common.confirm')}
        onPress={onConfirm}
        disabled={done}
        loading={confirming}
        style={{ alignSelf: 'stretch', marginTop: 10 }}
      />
    </CardShell>
  );
}

function BalanceCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <CardShell style={{ alignItems: 'center', gap: space.xs }}>
      <Text variant="cap">{t('home.balance')}</Text>
      <Text variant="money">{ltrIsolate(formatPaisa(Number(card.balancePaisa)))}</Text>
    </CardShell>
  );
}

/** Cards.dc.html gives a chip three looks: the amber-bordered option chip the
 *  disambiguation lists use, and — on the recipient card — an amber "Yes,
 *  continue" pill beside a surface2 "No". */
type ChipTone = 'outline' | 'primary' | 'secondary';

function ChipRow({ label, detail, logo, onPress, testID, tone = 'outline' }: {
  label: string;
  detail?: string;
  /** F1: the institution / biller mark, rendered before the label inside the chip.
   *  The chip keeps its ≥44pt height either way — the 24pt mark fits inside it. */
  logo?: React.ReactNode;
  onPress: () => void;
  testID?: string;
  tone?: ChipTone;
}) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const { style, onPressIn, onPressOut } = usePressScale();
  const labelColor = tone === 'primary' ? c.navy : c.ink;
  const labelWeight = tone === 'primary' ? 700 : 600;
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          backgroundColor: tone === 'primary' ? c.amber : c.surface2,
          borderRadius: radius.pill,
          borderWidth: tone === 'outline' ? 1 : 0,
          borderColor: c.amber,
          paddingHorizontal: tone === 'outline' ? space.m : space.l,
          paddingVertical: space.s,
          // A one-line chip is ~36pt tall from padding alone; the floor + centring
          // brings every chip (telco/institution/biller/recipient) up to the 44pt
          // minimum touch target without changing how a two-line chip looks.
          minHeight: touch.min, justifyContent: 'center',
        },
        style,
      ]}
    >
      {logo ? (
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.s }}>
          {logo}
          <View style={{ flexShrink: 1 }}>
            <Text variant="sub" weight={labelWeight} color={labelColor}>{label}</Text>
            {detail ? <Text variant="foot">{detail}</Text> : null}
          </View>
        </View>
      ) : (
        <>
          <Text variant="sub" weight={labelWeight} color={labelColor}>{label}</Text>
          {detail ? <Text variant="foot">{detail}</Text> : null}
        </>
      )}
    </AnimatedPressable>
  );
}

function RecipientChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const prompt = card.prompt as { en: string; ur: string };
  const recipients = (card.recipients ?? []) as RecipientChip[];
  // Several options can share the same nickname — that's exactly why they needed
  // disambiguating — so tapping one must send back more than the bare nickname, or the
  // model just re-runs the same ambiguous name search and re-shows this card forever.
  // The institution name is always unambiguous between options with the same nickname.
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
            logo={<InstitutionLogo size={24} shape="circle" name={r.institutionName} code={r.institutionId} logoUrl={r.institutionLogoUrl} />}
            onPress={() => onChipTap?.(`${r.nickname} at ${r.institutionName}`)}
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
            logo={<InstitutionLogo size={24} shape="circle" name={inst.name} code={inst.institutionId} logoUrl={inst.logoUrl} />}
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
              logo={<InstitutionLogo size={24} shape="rounded" name={b.name} code={b.billerId} logoUrl={b.logoUrl} />}
              onPress={() => onChipTap?.(label)}
            />
          );
        })}
      </View>
    </View>
  );
}

// recipient — HomeConversation.dc.html: a 36pt logo beside the name and the
// institution line, the question in ink2, then the two chips (amber "Yes,
// continue", surface2 "No").
function RecipientCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const shape = card as unknown as RecipientCardShape;
  const institution = shape.institution;

  return (
    <CardShell>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
        <InstitutionLogo
          size={LOGO_ROW}
          shape="circle"
          name={shape.title}
          code={institution?.id}
          logoUrl={institution?.logoUrl}
        />
        <View style={{ flexShrink: 1 }}>
          <Text variant="hl" weight={700} style={{ fontSize: 16 }} numberOfLines={1}>{shape.title}</Text>
          <Text variant="foot" color={c.ink2} numberOfLines={1}>
            {urdu && institution?.urduName ? institution.urduName : institution?.name} · {ltrIsolate(maskIdentifier(shape.identifier))}
          </Text>
        </View>
      </View>
      <Text variant="sub" color={c.ink2} style={{ fontSize: BODY_14, marginTop: 10, marginBottom: space.s }}>
        {urdu ? shape.prompt.ur : shape.prompt.en}
      </Text>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
        <ChipRow tone="primary" testID="chip-recipient-yes" label={t('chips.yesContinue')} onPress={() => onChipTap?.(t('chips.yesContinue'))} />
        <ChipRow tone="secondary" testID="chip-recipient-no" label={t('chips.no')} onPress={() => onChipTap?.(t('chips.no'))} />
      </View>
    </CardShell>
  );
}

function BillCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  return (
    <CardShell style={{ alignItems: 'center', gap: space.xs }}>
      <InstitutionLogo
        size={40}
        shape="rounded"
        name={String(card.biller)}
        logoUrl={typeof card.billerLogoUrl === 'string' ? card.billerLogoUrl : undefined}
        style={{ marginBottom: space.xs }}
      />
      <Text variant="hl" center>{String(card.biller)} · {String(card.consumerName)}</Text>
      <Text variant="money" style={{ fontSize: 32, lineHeight: 38 }}>{ltrIsolate(formatPaisa(Number(card.amountPaisa)))}</Text>
      <Text variant="foot" center>
        {t('bills.month')} {String(card.month)} · {t('bills.dueDate')} {ltrIsolate(String(card.dueDate).slice(0, 10))}
      </Text>
    </CardShell>
  );
}

function PocketCardView({ card }: { card: ChatCard }) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const goal = card.goalPaisa ? Number(card.goalPaisa) : 0;
  const pct = goal ? Math.min(1, Number(card.balancePaisa) / goal) : 0;
  return (
    <CardShell style={{ alignItems: 'center', gap: space.xs }}>
      <Text variant="hl" center>{String(card.emoji)} {urdu && card.urduName ? String(card.urduName) : String(card.name)}</Text>
      <Text variant="money" style={{ fontSize: 30, lineHeight: 36 }}>{ltrIsolate(formatPaisa(Number(card.balancePaisa)))}</Text>
      {goal ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: 'hidden', marginTop: space.s, alignSelf: 'stretch' }}>
          <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: c.amber }} />
        </View>
      ) : null}
    </CardShell>
  );
}

function StatementCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const period = card.period as { en: string; ur: string };
  return (
    <CardShell style={{ alignItems: 'center', gap: space.s }}>
      <FileText size={22} color={c.ink2} strokeWidth={2} />
      <Text variant="hl" center>{urdu ? period.ur : period.en}</Text>
      <Text variant="foot" center>
        {ltrIsolate(`${t('statements.moneyIn')} ${formatPaisa(Number(card.totalInPaisa))} · ${t('statements.moneyOut')} ${formatPaisa(Number(card.totalOutPaisa))}`)}
      </Text>
      <StatementDownload statementId={String(card.statementId)} />
    </CardShell>
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
  const items = (card.items as { id: string; direction: string; amountPaisa: number; counterparty: { name: string; urduName?: string; institutionLogoUrl?: string }; createdAt: string }[]).slice(0, 5);
  return (
    <CardShell style={{ gap: space.s }}>
      {items.map((txn) => (
        <View key={txn.id} style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s }}>
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.s, flexShrink: 1 }}>
            {/* Only where the counterparty's institution actually has a mark — a
                person-to-person row keeps its plain name, with no initials disc. */}
            {txn.counterparty.institutionLogoUrl ? (
              <InstitutionLogo size={24} shape="circle" name={txn.counterparty.name} logoUrl={txn.counterparty.institutionLogoUrl} />
            ) : null}
            <Text variant="foot">{urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name}</Text>
          </View>
          <Text variant="foot" color={txn.direction === 'in' ? c.green : c.ink}>
            {ltrIsolate((txn.direction === 'in' ? '+' : '−') + formatPaisa(txn.amountPaisa))}
          </Text>
        </View>
      ))}
    </CardShell>
  );
}

function SuccessCardView({ card }: { card: ChatCard }) {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const title = card.title as { en: string; ur: string };
  return (
    <CardShell style={{ alignItems: 'center', gap: space.s }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' }}>
        <Check size={22} color={c.green} strokeWidth={3} />
      </View>
      <Text variant="hl" center>{urdu ? title.ur : title.en}</Text>
      <Text variant="money" style={{ fontSize: 28, lineHeight: 34 }}>{formatPaisa(Number(card.amountPaisa))}</Text>
      <Pill label={String(card.refNo)} bg={c.surface2} color={c.ink2} />
    </CardShell>
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
      <CardShell style={{ alignItems: 'center', gap: space.s }}>
        <View testID="save-prompt-saved">
          <Pill label={t('save.saved')} bg={c.greenTint} color={c.green} />
        </View>
      </CardShell>
    );
  }

  if (dismissed) return null;

  return (
    <CardShell style={{ gap: space.m }}>
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
    </CardShell>
  );
}

// ---- v5 card kinds (spec §4.2 / §6) ----

/** The current language's half of a Bilingual field. */
function useBilingual(): (b: Bilingual | undefined) => string {
  const urdu = useIsUrdu();
  return (b) => (b ? (urdu ? b.ur : b.en) : '');
}

/** A label/value row, same shape as the DetailRow on app/txn/[id].tsx. */
function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View
      style={{
        flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between',
        paddingVertical: space.m, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.separator,
      }}
    >
      <Text variant="sub">{label}</Text>
      <Text variant="hl">{value}</Text>
    </View>
  );
}

// receipt — Cards.dc.html: a centred 44pt avatar/logo, "Sent to X" at 15/600,
// the amount at 28/800 coloured by direction (money in green, money out red),
// the status pill, the two-column details grid, and the Share ghost button —
// the one thing the AI turn adds over the full-screen receipt.
function ReceiptCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const bi = useBilingual();
  const shape = card as unknown as ReceiptCardShape;
  const txn = shape.txn;
  const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
  const sign = txn.direction === 'in' ? '+' : '−';
  // Artboard: money out is red (−₨2,550), money in green. The sign is the
  // static cue that survives colour-blindness / greyscale.
  const amountColor = txn.direction === 'in' ? c.green : c.red;
  const headline = txn.direction === 'in'
    ? t('activity.receivedFrom', { name })
    : t('activity.sentTo', { name });

  const onShare = () => {
    const message = bi(shape.shareText);
    if (!message) return;
    Share.share({ message }).catch(() => {
      // User dismissed the share sheet, or the platform refused it — nothing to recover.
    });
  };

  return (
    <CardShell>
      <View style={{ alignItems: 'center' }}>
        {txn.counterparty.institutionLogoUrl
          ? <InstitutionLogo size={LOGO_CARD} shape="circle" name={name} logoUrl={txn.counterparty.institutionLogoUrl} />
          : <Avatar name={name} size={ICON_CIRCLE} />}
        <Text variant="sub" weight={600} color={c.ink} center style={{ marginTop: space.s }}>{headline}</Text>
        <Text variant="money" style={{ fontSize: 28, lineHeight: 34 }} color={amountColor}>
          {ltrIsolate(sign + formatPaisa(txn.amountPaisa))}
        </Text>
        <Pill
          label={t('activity.completed')}
          bg={c.greenTint}
          color={c.green}
          icon={<Check size={12} color={c.green} strokeWidth={3} />}
          style={{ alignSelf: 'center', marginTop: 6 }}
        />
      </View>
      <View style={{ marginTop: space.m }}>
        <DetailGrid
          rows={[
            [t('activity.date'), ltrIsolate(new Date(txn.createdAt).toLocaleString())],
            [t('activity.category'), txn.category],
            [t('activity.refNo'), ltrIsolate(txn.refNo)],
          ]}
        />
      </View>
      <Button
        testID="chat-receipt-share"
        variant="ghost"
        label={t('cards.receipt.share')}
        icon={<Share2 size={20} color={c.ink2} strokeWidth={2} />}
        onPress={onShare}
        style={{ marginTop: space.s }}
      />
    </CardShell>
  );
}

// spending — Cards.dc.html: the period/money-out caption, the total at 30/800,
// one 6pt amber-on-surface2 bar per category, and the compare row in red (spent
// more) or green (spent less). Plain bars, no chart library (spec §6).
function SpendingCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const bi = useBilingual();
  const shape = card as unknown as SpendingCardShape;
  const compare = shape.compare ?? undefined;
  const delta = compare ? compare.deltaPaisa : 0;
  // Spending MORE is the bad direction — red with an up arrow; spending less is green.
  const deltaColor = delta > 0 ? c.red : delta < 0 ? c.green : c.ink2;
  const DeltaIcon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  const comparePeriod = compare ? bi(compare.period) : '';
  const compareText = !compare ? ''
    : delta === 0 ? t('cards.spending.sameAs', { period: comparePeriod })
      : t(delta > 0 ? 'cards.spending.moreThan' : 'cards.spending.lessThan', {
        amount: formatPaisa(Math.abs(delta)), period: comparePeriod,
      });

  return (
    <CardShell>
      <Text variant="cap">{`${bi(shape.period)} · ${t('cards.spending.moneyOut')}`}</Text>
      <Text variant="money" style={{ fontSize: 30, lineHeight: 36 }}>
        {ltrIsolate(formatPaisa(shape.totalOutPaisa))}
      </Text>
      <Text variant="foot">
        {ltrIsolate(`${t('cards.spending.moneyIn')} ${formatPaisa(shape.totalInPaisa)}`)}
      </Text>

      {shape.byCategory.length ? (
        shape.byCategory.map((row) => (
          <View key={row.category} style={{ marginTop: space.s }}>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: space.s }}>
              <Text variant="sub" color={c.ink} style={{ fontSize: BODY_14, flexShrink: 1 }} numberOfLines={1}>{bi(row.label)}</Text>
              <Text variant="sub" weight={600} color={c.ink} style={{ fontSize: BODY_14 }}>{ltrIsolate(formatPaisa(row.totalPaisa))}</Text>
            </View>
            <View style={{ height: BAR_H, borderRadius: BAR_H / 2, backgroundColor: c.surface2, overflow: 'hidden', marginTop: space.xs }}>
              <View
                testID={`spending-bar-${row.category}`}
                style={{
                  // share is 0..1 from the service; clamp so a bad value can't
                  // overflow the track or render a negative width.
                  width: `${Math.max(0, Math.min(1, row.share)) * 100}%`,
                  height: BAR_H, borderRadius: BAR_H / 2, backgroundColor: c.amber,
                  alignSelf: urdu ? 'flex-end' : 'flex-start',
                }}
              />
            </View>
          </View>
        ))
      ) : (
        <Text variant="foot" center style={{ marginTop: space.s }}>{t('cards.empty')}</Text>
      )}

      {compare ? (
        <View
          testID="spending-compare"
          style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
        >
          <DeltaIcon size={16} color={deltaColor} strokeWidth={2.4} />
          <Text variant="foot" weight={600} color={deltaColor} style={{ flex: 1 }}>{compareText}</Text>
        </View>
      ) : null}
    </CardShell>
  );
}

function AccountCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const shape = card as unknown as AccountCardShape;
  const name = urdu && shape.urduName ? shape.urduName : shape.name;
  return (
    <CardShell style={{ gap: space.m }}>
      <View style={{ alignItems: 'center', gap: space.s }}>
        <Avatar name={name} size={56} />
        <Text variant="hl" center>{name}</Text>
        <Text variant="money" style={{ fontSize: 28, lineHeight: 34 }}>
          {ltrIsolate(formatPaisa(shape.balancePaisa))}
        </Text>
      </View>
      <View>
        <DetailRow label={t('cards.account.phone')} value={ltrIsolate(shape.phone)} />
        <DetailRow label={t('cards.account.memberSince')} value={ltrIsolate(shape.memberSince.slice(0, 10))} />
        <DetailRow
          label={t('cards.account.language')}
          value={shape.language === 'ur' ? t('profile.urdu') : t('profile.english')}
          last
        />
      </View>
    </CardShell>
  );
}

// profile — shows what actually changed. When `applied` includes 'language' the
// app switches i18n itself (spec §6), through the same applyLanguage() the
// More → Profile toggle uses, so the choice survives a cold start.
function ProfileCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const shape = card as unknown as ProfileCardShape;
  const applied = shape.applied ?? [];
  const language = shape.language;
  const appliedLanguage = applied.includes('language');

  useEffect(() => {
    if (!appliedLanguage || !language) return;
    if (i18n.language === language) return;
    applyLanguage(language).catch(() => {
      // Persisting failed; the in-session switch already happened.
    });
  }, [appliedLanguage, language]);

  const name = urdu && shape.urduName ? shape.urduName : shape.name;
  const labels: Record<string, string> = {
    name: t('cards.profile.updatedName'),
    urduName: t('cards.profile.updatedUrduName'),
    language: t('cards.profile.updatedLanguage'),
  };

  return (
    <CardShell style={{ alignItems: 'center', gap: space.s }}>
      <Avatar name={name} size={48} />
      <Text variant="hl" center>{t('cards.profile.title')}</Text>
      <Text variant="sub" center>{name}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, justifyContent: 'center' }}>
        {applied.map((field) => (
          <Pill key={field} label={labels[field] ?? field} bg={c.greenTint} color={c.green} />
        ))}
      </View>
    </CardShell>
  );
}

// help — Cards.dc.html "Things you can say": the caption, then 44pt rows at
// 15/600 with an 18pt chevron and a separator. Every row sends the intent
// phrased in the language the user is reading, so the assistant answers in that
// language too.
function HelpCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const bi = useBilingual();
  const shape = card as unknown as HelpCardShape;
  return (
    <CardShell style={{ gap: space.xs }}>
      <Text variant="cap">{t('cards.help.title')}</Text>
      {shape.intents.map((item, i) => (
        <ListRow
          key={`${item.intent.en}-${i}`}
          testID={`chat-help-${i}`}
          title={<Text variant="sub" weight={600} color={c.ink} numberOfLines={1}>{bi(item.label)}</Text>}
          right={<RowChevron />}
          separator={i < shape.intents.length - 1}
          style={{ minHeight: touch.min }}
          onPress={() => onChipTap?.(bi(item.intent))}
        />
      ))}
    </CardShell>
  );
}

// card — the gradient-less navy card visual from app/card.tsx. Only ever
// renders `maskedPan`: the full pan and the CVV are not in this contract, and
// a payload that smuggled them in still would not display them.
function CardCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const shape = card as unknown as CardCardShape;
  // holder is optional on CardSummary (older backends omit it) and the whole
  // labelled block is dropped rather than rendered as an empty line.
  const holder = (shape.holder ?? '').toUpperCase();
  return (
    <View style={{ marginTop: space.s, gap: space.s }}>
      <View
        testID="chat-card-visual"
        style={{
          height: 190, borderRadius: 24, padding: 20,
          backgroundColor: shape.frozen ? c.ink3 : c.navy,
          overflow: 'hidden', justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text weight={800} color={c.white} style={{ letterSpacing: 1.5 }}>PAYO</Text>
          <Pill
            label={shape.frozen ? t('card.frozen') : t('cards.card.active')}
            bg="rgba(255,255,255,0.14)"
            color={c.white}
          />
        </View>
        <Text color={c.white} weight={600} style={{ fontSize: 20, letterSpacing: 3 }}>
          {ltrIsolate(shape.maskedPan)}
        </Text>
        <View
          style={{
            flexDirection: 'row', alignItems: 'flex-end',
            // With no holder the expiry is the only block left — keep it on the
            // right where it sits on the full Card screen, rather than letting
            // space-between slide it across to the left edge.
            justifyContent: holder ? 'space-between' : 'flex-end',
          }}
        >
          {holder ? (
            <View>
              <Text variant="cap" color="rgba(255,255,255,0.55)">{t('card.holder')}</Text>
              <Text color={c.white} weight={600} style={{ marginTop: 2 }}>{holder}</Text>
            </View>
          ) : null}
          <View>
            <Text variant="cap" color="rgba(255,255,255,0.55)">{t('card.expiry')}</Text>
            <Text color={c.white} weight={600} style={{ marginTop: 2 }}>{ltrIsolate(shape.expiry)}</Text>
          </View>
        </View>
      </View>
      <Text variant="foot" center>{t('cards.card.hint')}</Text>
    </View>
  );
}

function StatementsCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const bi = useBilingual();
  const shape = card as unknown as StatementsCardShape;
  if (!shape.items.length) {
    return (
      <CardShell>
        <Text variant="foot" center>{t('statements.empty')}</Text>
      </CardShell>
    );
  }
  return (
    <CardShell style={{ gap: space.xs }}>
      <Text variant="cap">{t('cards.statements.title')}</Text>
      {shape.items.map((item, i) => (
        <ListRow
          key={item.statementId}
          testID={`chat-statement-${item.statementId}`}
          left={<FileText size={20} color={c.ink2} strokeWidth={2} />}
          title={bi(item.period)}
          subtitle={ltrIsolate(`${t('statements.moneyIn')} ${formatPaisa(item.totalInPaisa)} · ${t('statements.moneyOut')} ${formatPaisa(item.totalOutPaisa)}`)}
          separator={i < shape.items.length - 1}
          style={{ minHeight: touch.min }}
          right={<Download size={20} color={c.ink2} strokeWidth={2} />}
          // Same destination as the single-statement card's Download button —
          // the Statements screen owns the authenticated PDF fetch + share.
          onPress={() => router.push('/statements')}
        />
      ))}
    </CardShell>
  );
}

/** A list card body: a titled card of ≥44pt rows, or the empty line. */
function ListCard({ title, empty, children }: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <CardShell style={{ gap: space.xs }}>
      <Text variant="cap">{title}</Text>
      {empty ? <Text variant="foot" center>{t('cards.empty')}</Text> : children}
    </CardShell>
  );
}

function RecipientsCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const shape = card as unknown as RecipientsCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.recipients.title')} empty={items.length === 0}>
      {items.map((r, i) => (
        <ListRow
          key={r.recipientId}
          testID={`chat-recipient-${r.recipientId}`}
          left={<InstitutionLogo size={32} shape="circle" name={r.title} code={r.institutionId} logoUrl={r.institutionLogoUrl} />}
          title={r.nickname}
          subtitle={`${r.institutionName} · ${ltrIsolate(maskIdentifier(r.identifier))}`}
          showChevron
          separator={i < items.length - 1}
          style={{ minHeight: touch.min }}
          onPress={() => onChipTap?.(t('cards.recipients.intent', { name: r.nickname }))}
        />
      ))}
    </ListCard>
  );
}

function BillsCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const shape = card as unknown as BillsCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.bills.title')} empty={items.length === 0}>
      {items.map((b, i) => (
        <ListRow
          key={b.billId}
          testID={`chat-bill-${b.billId}`}
          left={<InstitutionLogo size={32} shape="rounded" name={b.biller} logoUrl={b.billerLogoUrl} />}
          title={`${b.biller} · ${b.consumerName}`}
          subtitle={ltrIsolate(`${t('bills.dueDate')} ${String(b.dueDate).slice(0, 10)}`)}
          right={<Text variant="hl">{ltrIsolate(formatPaisa(b.amountPaisa))}</Text>}
          separator={i < items.length - 1}
          style={{ minHeight: touch.min }}
          onPress={() => onChipTap?.(t('cards.bills.intent', { name: b.biller }))}
        />
      ))}
    </ListCard>
  );
}

function BillersCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const shape = card as unknown as BillersCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.billers.title')} empty={items.length === 0}>
      {items.map((b, i) => {
        const label = urdu && b.urduName ? b.urduName : b.name;
        return (
          <ListRow
            key={b.savedBillerId ?? b.billerId}
            testID={`chat-biller-${b.savedBillerId ?? b.billerId}`}
            left={<InstitutionLogo size={32} shape="rounded" name={b.name} code={b.billerId} logoUrl={b.logoUrl} />}
            title={label}
            subtitle={b.consumerNo ? ltrIsolate(b.consumerNo) : undefined}
            showChevron
            separator={i < items.length - 1}
            style={{ minHeight: touch.min }}
            onPress={() => onChipTap?.(t('cards.bills.intent', { name: label }))}
          />
        );
      })}
    </ListCard>
  );
}

function TelcoChipsCardView({ card, onChipTap }: Props) {
  const urdu = useIsUrdu();
  const bi = useBilingual();
  const shape = card as unknown as TelcoChipsCardShape;
  const telcos = shape.telcos ?? [];
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="foot">{bi(shape.prompt)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s }}>
        {telcos.map((telco) => {
          const label = urdu && telco.urduName ? telco.urduName : telco.name;
          return (
            <ChipRow
              key={telco.telcoId}
              testID={`chip-telco-${telco.telcoId}`}
              label={label}
              onPress={() => onChipTap?.(label)}
            />
          );
        })}
      </View>
    </View>
  );
}

function PocketsCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const shape = card as unknown as PocketsCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.pockets.title')} empty={items.length === 0}>
      {items.map((p, i) => {
        const name = urdu && p.urduName ? p.urduName : p.name;
        return (
          <ListRow
            key={p.pocketId}
            testID={`chat-pocket-${p.pocketId}`}
            title={`${p.emoji} ${name}`}
            subtitle={
              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <Text variant="foot">{ltrIsolate(formatPaisa(p.balancePaisa))}</Text>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}>
                  <View
                    testID={`chat-pocket-progress-${p.pocketId}`}
                    style={{
                      width: `${Math.max(0, Math.min(1, p.progress ?? 0)) * 100}%`,
                      height: 6, borderRadius: 3, backgroundColor: c.amber,
                      alignSelf: urdu ? 'flex-end' : 'flex-start',
                    }}
                  />
                </View>
              </View>
            }
            separator={i < items.length - 1}
            style={{ minHeight: touch.min }}
            onPress={() => onChipTap?.(t('cards.pockets.intent', { name }))}
          />
        );
      })}
    </ListCard>
  );
}

/** One money request. Approve/Decline are offered only for an incoming request
 *  that is still pending — an outgoing or settled one has nothing to act on.
 *  Both buttons send a turn, so the assistant runs the tool and the loop stays live. */
function RequestRow({ item, onChipTap, separator }: {
  item: RequestItem;
  onChipTap?: (text: string) => void;
  separator: boolean;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const name = urdu && item.counterparty.urduName ? item.counterparty.urduName : item.counterparty.name;
  const actionable = item.direction === 'in' && item.status === 'pending';
  const headline = item.direction === 'in'
    ? t('cards.requests.owesYou', { name })
    : t('cards.requests.youOwe', { name });

  return (
    <View
      testID={`chat-request-${item.requestId}`}
      style={{
        gap: space.s, paddingVertical: space.m,
        borderBottomWidth: separator ? 1 : 0, borderBottomColor: c.separator,
      }}
    >
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
        <Avatar name={name} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="hl" numberOfLines={1}>{headline}</Text>
          {item.note ? <Text variant="foot" numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <Text variant="hl">{ltrIsolate(formatPaisa(item.amountPaisa))}</Text>
      </View>
      {actionable ? (
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
          <Button
            testID={`chat-request-approve-${item.requestId}`}
            label={t('requests.approve')}
            onPress={() => onChipTap?.(t('cards.requests.approveIntent', { id: item.requestId }))}
            style={{ flex: 1 }}
          />
          <Button
            testID={`chat-request-decline-${item.requestId}`}
            variant="secondary"
            label={t('requests.decline')}
            onPress={() => onChipTap?.(t('cards.requests.declineIntent', { id: item.requestId }))}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <Pill
          label={t(`requests.${item.status}`, { defaultValue: item.status })}
          bg={c.surface2}
          color={c.ink2}
        />
      )}
    </View>
  );
}

function RequestCardView({ card, onChipTap }: Props) {
  const shape = card as unknown as RequestCardShape;
  return (
    <CardShell>
      <RequestRow item={shape as RequestItem} onChipTap={onChipTap} separator={false} />
    </CardShell>
  );
}

function RequestsCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const shape = card as unknown as RequestsCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.requests.title')} empty={items.length === 0}>
      {items.map((item, i) => (
        <RequestRow
          key={item.requestId}
          item={item}
          onChipTap={onChipTap}
          separator={i < items.length - 1}
        />
      ))}
    </ListCard>
  );
}

// qr — the same react-native-qrcode-svg renderer app/qr uses, on the white
// backing the scanner needs regardless of theme.
function QrCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const shape = card as unknown as QrCardShape;
  return (
    <CardShell style={{ alignItems: 'center', gap: space.s }}>
      <Text variant="cap">{t('cards.qr.title')}</Text>
      <View style={{ backgroundColor: c.white, borderRadius: radius.tile, padding: space.l }}>
        {shape.payload
          ? <QRCode value={shape.payload} size={180} />
          : <QrIcon size={64} color={c.ink3} strokeWidth={1.5} />}
      </View>
      <Text variant="hl" center>{shape.name}</Text>
      <Text variant="foot" center>{ltrIsolate(shape.phone)}</Text>
      <Text variant="foot" center>{t('cards.qr.hint')}</Text>
    </CardShell>
  );
}

// ---- v6: guardian, scam interruption, proactive greeting (spec §4) ----

/** Human label for a risk flag. Unknown flags render as nothing rather than as
 *  a raw enum — a card from a newer AI service must never leak `snake_case`. */
function RiskFlags({ flags, center }: { flags?: string[]; center?: boolean }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const known = (flags ?? []).filter((f) => f === 'new_recipient_large' || f === 'pressure_language');
  if (!known.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: center ? 'center' : 'flex-start' }}>
      {known.map((f) => (
        <Pill
          key={f}
          label={t(f === 'new_recipient_large' ? 'risk.newRecipientLarge' : 'risk.pressureLanguage')}
          bg={c.amberTint}
          color={c.amberDeep}
        />
      ))}
    </View>
  );
}

/** The waiting-approval card the check-in hands off to, built from the action the
 *  backend just returned. Kept next to the check-in so both agree on the shape. */
function waitingCardFor(action: PendingAction, guardianName: string): ChatCard {
  const shape: WaitingApprovalCardShape = {
    kind: 'waiting_approval',
    actionId: action.id,
    guardianName,
    expiresAt: action.expiresAt,
    amountPaisa: action.amountPaisa,
    summary: action.summary,
  };
  return shape as unknown as ChatCard;
}

/**
 * check_in — the scam interruption (spec §1 rule 8). Two large answers, nothing else:
 * "Yes, someone asked me" cancels the send outright and explains calmly; "No, this is
 * my own idea" simply records the answer and lets whatever gate is next decide — the
 * RETURNED action does that, not this card: `approval.status === 'waiting'` becomes a
 * waiting-approval card, anything else opens the PIN sheet.
 */
function CheckInCardView({ card, onAppendLocal, live }: {
  card: ChatCard;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  /** False for a card rehydrated from persisted history — the two answers are
   *  disabled, since the action they belong to is from an earlier session. */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const bi = useBilingual();
  const shape = card as unknown as CheckInCardShape;
  const { openPinSheet } = usePinSheet();
  const { speak } = useOutcomeSpeech();
  const [checkIn] = useCheckInActionMutation();
  const [execute] = useExecuteActionMutation();
  const { data: me } = useMeQuery();
  const [answered, setAnswered] = useState<'yes' | 'no' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useActionDone(shape.actionId);
  const restored = live === false;

  const answer = async (someoneAsked: boolean) => {
    if (busy || answered || done || restored) return;
    setBusy(true);
    setError(null);
    try {
      const action = await checkIn({ id: shape.actionId, someoneAsked }).unwrap();
      setAnswered(someoneAsked ? 'yes' : 'no');
      // "Yes" — the backend already cancelled it (`scam_checkin`). The card
      // becomes the cancelled state; the assistant's own words do the rest.
      if (someoneAsked) return;

      if (action.approval?.status === 'waiting') {
        onAppendLocal?.({
          role: 'assistant',
          text: '',
          cards: [waitingCardFor(action, me?.user.guardian?.name ?? '')],
        });
        return;
      }
      if (!action.requiresPin) {
        const res = await execute({ id: action.id }).unwrap();
        markActionDone(action.id);
        onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(action.summary, res, res.recipientSuggestion, res.billerSuggestion) });
        speak(res, action);
        return;
      }
      const res = await openPinSheet(action);
      onAppendLocal?.({ role: 'assistant', text: '', cards: buildResultCards(action.summary, res, res.recipientSuggestion, res.billerSuggestion) });
      speak(res, action);
    } catch (e) {
      // A dismissed PIN sheet is not an error, and the check-in answer stands —
      // only surface a real failure, and only re-arm the buttons when the
      // ANSWER itself failed (the sheet can be retried from the confirmation).
      const message = (e as Error)?.message;
      if (message === 'cancelled' || message === 'busy') return;
      setError(apiErr(e).message);
      setAnswered(null);
    } finally {
      setBusy(false);
    }
  };

  // Cards.dc.html check-in: a 44pt shield in amberTint, the question at 17/700,
  // the risk flag pill, then the two stacked 56pt answers. Answering "yes" keeps
  // the same card and swaps the shield for the green ShieldCheck (IconSwap) —
  // one card, one state change, so the change is visible rather than a cut.
  const stopped = answered === 'yes';

  return (
    <CardShell style={{ alignItems: 'center' }}>
      {stopped ? <View testID="check-in-cancelled" /> : null}
      <View
        style={{
          width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: ICON_CIRCLE / 2,
          backgroundColor: stopped ? c.greenTint : c.amberTint,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconSwap
          active={stopped}
          size={ICON_GLYPH}
          from={<ShieldAlert size={ICON_GLYPH} color={c.amberDeep} strokeWidth={2.4} />}
          to={<ShieldCheck size={ICON_GLYPH} color={c.green} strokeWidth={2.4} />}
        />
      </View>
      <Text variant="hl" weight={700} center style={{ marginTop: space.s, marginBottom: space.xs }}>
        {stopped ? t('cards.checkIn.stopped') : bi(shape.prompt)}
      </Text>
      {stopped ? (
        <Text variant="sub" center>{t('cards.checkIn.stoppedBody')}</Text>
      ) : (
        <>
          <RiskFlags flags={shape.riskFlags} center />
          {error ? <Text variant="sub" color={c.red} center style={{ marginTop: space.s }}>{error}</Text> : null}
          {/* Two answers only, both ≥56pt (touch.primary) — the spec's "two large buttons". */}
          <View style={{ alignSelf: 'stretch', marginTop: space.m, gap: space.s }}>
            <Button
              testID="check-in-yes"
              label={t('cards.checkIn.yes')}
              onPress={() => answer(true)}
              loading={busy && answered === null}
              disabled={answered !== null || done || restored}
              style={{ minHeight: touch.primary, alignSelf: 'stretch' }}
            />
            <Button
              testID="check-in-no"
              variant="secondary"
              label={t('cards.checkIn.no')}
              onPress={() => answer(false)}
              disabled={busy || answered !== null || done || restored}
              style={{ minHeight: touch.primary, alignSelf: 'stretch' }}
            />
          </View>
        </>
      )}
    </CardShell>
  );
}

/** mm:ss left until `iso`, or null once it has passed. */
function msLeft(iso: string, now: number): number | null {
  const ms = Date.parse(iso) - now;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const REMIND_COOLDOWN_MS = 60_000;

/**
 * waiting_approval — the send is parked until the guardian decides (spec §1 rules 4-6).
 *
 * Poll lifecycle: GET /actions/:id every 3 s, but ONLY while this card is mounted AND
 * the outcome is still `waiting` (`skip` switches the subscription off the moment the
 * card settles, so an approved/declined/expired card costs no traffic at all).
 *
 * On `approved` the PIN sheet opens BY ITSELF, exactly once per action id — the claim
 * goes through the same `claimAutoOpenPin` guard the confirmation card uses, so a
 * FlatList recycle or a re-render cannot open a second sheet, and a 'busy' rejection
 * hands the claim back so the one auto-open it is owed is not silently spent.
 */
function WaitingApprovalCardView({ card, onAppendLocal, live }: {
  card: ChatCard;
  onAppendLocal?: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  /** False for a card rehydrated from persisted history. It is passed straight
   *  through to claimAutoOpenPin, so a waiting card the user saw in an EARLIER
   *  session can never open the PIN sheet by itself on relaunch — the poll may
   *  still report `approved`, but the sheet is then only opened by the button. */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const bi = useBilingual();
  const shape = card as unknown as WaitingApprovalCardShape;
  const { openPinSheet } = usePinSheet();
  const { speak } = useOutcomeSpeech();
  const [remind, { isLoading: reminding }] = useRemindGuardianMutation();
  const [outcome, setOutcome] = useState<ApprovalOutcome>('waiting');
  const [reason, setReason] = useState<string | null>(null);
  /** The approved action, kept so a cancelled sheet can be reopened by hand. */
  const [approved, setApproved] = useState<PendingAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [remindedAt, setRemindedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: polled } = useActionQuery(shape.actionId, {
    pollingInterval: 3000,
    skip: outcome !== 'waiting',
  });
  const doneApproved = useActionDone(shape.actionId);

  // One ticking clock drives both the expiry countdown and the Remind cooldown.
  useEffect(() => {
    if (outcome !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [outcome]);

  const onAppendRef = useRef(onAppendLocal);
  onAppendRef.current = onAppendLocal;
  const openRef = useRef(openPinSheet);
  openRef.current = openPinSheet;
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const openSheet = useCallback((action: PendingAction) =>
    openRef.current(action)
      .then((res) => {
        onAppendRef.current?.({
          role: 'assistant', text: '',
          cards: buildResultCards(action.summary, res, res.recipientSuggestion, res.billerSuggestion),
        });
        speakRef.current(res, action);
      })
      .catch((e: Error) => {
        // Same contract as the confirmation card: 'busy' means no sheet was ever
        // shown, so the claim is given back and the next mount may open it.
        // 'cancelled' keeps the claim — the Confirm button below is the retry.
        if (e?.message === 'busy') releaseAutoOpen(action.id);
      }), []);

  useEffect(() => {
    if (!polled || outcome !== 'waiting') return;
    const next = approvalOutcome(polled, Date.now());
    if (next === 'waiting') return;
    setOutcome(next);
    if (next === 'declined') { setReason(polled.approval?.reason ?? null); return; }
    if (next !== 'approved') return;
    setApproved(polled);
    // `live` decides whether this may open the sheet BY ITSELF: a card restored
    // from history must not, however the poll settles.
    const claimed = claimAutoOpenPin(polled.id, {
      requiresPin: Boolean(polled.requiresPin), live: live !== false, done: false,
    });
    if (claimed) openSheet(polled);
  }, [polled, outcome, live, openSheet]);

  const left = msLeft(shape.expiresAt, now);
  useEffect(() => {
    if (outcome === 'waiting' && left === null) setOutcome('expired');
  }, [outcome, left]);

  const cooldownLeft = remindedAt ? Math.max(0, REMIND_COOLDOWN_MS - (now - remindedAt)) : 0;

  const onRemind = async () => {
    if (cooldownLeft > 0 || reminding) return;
    setError(null);
    try {
      await remind(shape.actionId).unwrap();
      setRemindedAt(Date.now());
    } catch (e) {
      const err = apiErr(e);
      // 429 REMIND_TOO_SOON — the server's cooldown is authoritative; start the
      // local one anyway so the button stops inviting another rejected tap.
      if (err.code === 'REMIND_TOO_SOON') setRemindedAt(Date.now());
      else setError(err.message);
    }
  };

  const statusColor = outcome === 'declined' || outcome === 'expired' ? c.red : c.amberDeep;
  /** Named copy when the guardian's name travelled with the card, standalone copy
   *  otherwise — never a lowercase name substituted at the start of a sentence. */
  const gt = (base: string, opts?: Record<string, unknown>) => {
    const { key, name } = guardianCopy(base, shape.guardianName);
    return t(key, { name, ...opts });
  };
  // The send finished (the PIN sheet resolved and marked the action done): there is
  // nothing left to confirm, and the success card below already carries the ref no.
  const sent = doneApproved || polled?.status === 'completed';

  // Cards.dc.html waiting card: a 44pt clock in amberTint, the summary at
  // 15/600, the amount at 28/800, the named body line, the expiry foot, and the
  // secondary Remind button. The clock becomes a green check the moment the
  // guardian settles it (IconSwap) — the amber → green disc is the static cue.
  const settledOk = sent || outcome === 'approved';

  return (
    <CardShell style={{ alignItems: 'center' }}>
      <View testID={`waiting-approval-${shape.actionId}`} />
      <View
        style={{
          width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: ICON_CIRCLE / 2,
          backgroundColor: settledOk ? c.greenTint : c.amberTint,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconSwap
          active={settledOk}
          size={ICON_GLYPH}
          from={<Clock size={ICON_GLYPH} color={statusColor} strokeWidth={2.4} />}
          to={sent
            ? <Check size={ICON_GLYPH} color={c.green} strokeWidth={3} />
            : <ShieldCheck size={ICON_GLYPH} color={c.green} strokeWidth={2.4} />}
        />
      </View>
      <Text variant="sub" weight={600} color={c.ink} center style={{ marginTop: space.s }}>{bi(shape.summary)}</Text>
      <Text variant="money" style={{ fontSize: 28, lineHeight: 34 }}>{ltrIsolate(formatPaisa(shape.amountPaisa))}</Text>

      {outcome === 'waiting' ? (
        <>
          <Text variant="sub" center style={{ fontSize: BODY_14, marginTop: 6, marginBottom: 6 }}>{gt('cards.waiting.body')}</Text>
          <Text testID="waiting-countdown" variant="foot" center style={{ fontSize: FOOT_12, lineHeight: 16 }}>
            {left === null ? t('cards.waiting.expired') : t('cards.waiting.expiresIn', { time: ltrIsolate(formatCountdown(left)) })}
          </Text>
          {error ? <Text variant="sub" color={c.red} center style={{ marginTop: space.s }}>{error}</Text> : null}
          <Button
            testID="waiting-remind"
            variant="secondary"
            label={cooldownLeft > 0
              ? t('cards.waiting.remindWait', { seconds: Math.ceil(cooldownLeft / 1000) })
              : gt('cards.waiting.remind')}
            icon={<BellRing size={20} color={c.ink} strokeWidth={2} />}
            onPress={onRemind}
            disabled={cooldownLeft > 0}
            loading={reminding}
            style={{ alignSelf: 'stretch', marginTop: 10 }}
          />
        </>
      ) : (
        <View style={{ alignSelf: 'stretch', alignItems: 'center', marginTop: 6, gap: 10 }}>
          <Text
            testID="waiting-outcome"
            variant="sub"
            center
            style={{ fontSize: BODY_14 }}
            color={outcome === 'approved' ? c.green : c.red}
          >
            {sent
              ? t('cards.waiting.sent')
              : outcome === 'approved'
                ? gt('cards.waiting.approved')
                : outcome === 'expired'
                  ? t('cards.waiting.expiredBody')
                  : reason
                    ? gt('cards.waiting.declinedReason', { reason })
                    : gt('cards.waiting.declined')}
          </Text>
          {/* Dismissing the auto-opened sheet (or a restored card, which never
              auto-opens at all) must not strand an approved send with no way to
              finish it — the same openPinSheet call, on a button. Once the send has
              actually gone through there is nothing left to confirm, so the button
              disappears rather than sitting there dimmed. */}
          {outcome === 'approved' && approved && !sent ? (
            <Button
              testID="waiting-confirm"
              label={t('confirm.confirmWithPin')}
              onPress={() => openSheet(approved)}
              style={{ alignSelf: 'stretch' }}
            />
          ) : null}
        </View>
      )}
    </CardShell>
  );
}

/**
 * One row of the guardian's approval inbox. Approve opens the PIN sheet in GUARDIAN
 * mode — the typed PIN goes to POST /approvals/:id/approve (the guardian's own PIN,
 * sharing the login lockout), never to the payer's execute endpoint. Decline takes an
 * optional reason and needs no PIN.
 */
function ApprovalRow({ item, separator }: { item: ApprovalItemShape; separator: boolean }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const bi = useBilingual();
  const { openPinSheet } = usePinSheet();
  const { speak } = useOutcomeSpeech();
  const [approve] = useApproveApprovalMutation();
  const [decline, { isLoading: declining }] = useDeclineApprovalMutation();
  const [settled, setSettled] = useState<'approved' | 'declined' | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asAction: PendingAction = {
    id: item.actionId, kind: 'guardian_approval', amountPaisa: item.amountPaisa, feePaisa: 0,
    summary: item.summary, lines: [], requiresPin: true, expiresAt: item.expiresAt, status: 'pending',
  };

  const onApprove = async () => {
    if (busy || settled) return;
    setBusy(true);
    setError(null);
    try {
      await openPinSheet(asAction, {
        execute: async (pin) => { await approve({ id: item.actionId, pin }).unwrap(); },
      });
      setSettled('approved');
      // Guardian mode resolves with no transaction — the payer still has to
      // type their own PIN, and outcomeSpeech words it that way.
      speak({ transaction: null }, { ...asAction, payerName: item.payerName });
    } catch (e) {
      const message = (e as Error)?.message;
      if (message !== 'cancelled' && message !== 'busy') setError(apiErr(e).message);
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    if (busy || settled) return;
    setBusy(true);
    setError(null);
    try {
      await decline({ id: item.actionId, reason: reason.trim() || undefined }).unwrap();
      setSettled('declined');
    } catch (e) {
      setError(apiErr(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      testID={`approval-${item.actionId}`}
      style={{ gap: space.s, paddingVertical: space.m, borderBottomWidth: separator ? 1 : 0, borderBottomColor: c.separator }}
    >
      {/* Cards.dc.html approvals row: 36pt avatar, payer at 15/700 over the
          summary at 13, the amount at 800 on the trailing edge. */}
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={item.payerName} size={ROW_LOGO} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="sub" weight={700} color={c.ink} numberOfLines={1}>{item.payerName}</Text>
          <Text variant="foot" color={c.ink2} numberOfLines={1}>{bi(item.summary)}</Text>
        </View>
        <Text variant="sub" weight={800} color={c.ink}>{ltrIsolate(formatPaisa(item.amountPaisa))}</Text>
      </View>
      <RiskFlags flags={item.riskFlags} />
      {error ? <Text variant="sub" color={c.red}>{error}</Text> : null}
      {settled ? (
        <Pill
          label={settled === 'approved' ? t('cards.approvals.approved') : t('cards.approvals.declined')}
          bg={settled === 'approved' ? c.greenTint : c.redTint}
          color={settled === 'approved' ? c.green : c.red}
        />
      ) : reasonOpen ? (
        <View style={{ gap: space.s }}>
          <Input
            testID={`approval-reason-${item.actionId}`}
            placeholder={t('cards.approvals.reasonPlaceholder')}
            value={reason}
            onChangeText={setReason}
          />
          <Button
            testID={`approval-decline-confirm-${item.actionId}`}
            variant="danger"
            label={t('cards.approvals.decline')}
            onPress={onDecline}
            loading={declining}
            style={{ alignSelf: 'stretch', minHeight: touch.min }}
          />
          <Button
            testID={`approval-decline-cancel-${item.actionId}`}
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => { setReasonOpen(false); setReason(''); }}
            style={{ alignSelf: 'stretch', minHeight: touch.min }}
          />
        </View>
      ) : (
        // Stacked, not side by side: two half-width buttons inside a chat bubble
        // (itself capped at 86% of the screen) left "Approve"/"Decline" too little
        // room and the label wrapped mid-word ("Appro/ve"). Full width also suits
        // the longer Urdu labels, and this is a money decision — not a place to
        // make the two choices harder to hit.
        <View style={{ gap: space.s }}>
          <Button
            testID={`approval-approve-${item.actionId}`}
            label={t('cards.approvals.approve')}
            onPress={onApprove}
            loading={busy}
            style={{ alignSelf: 'stretch', minHeight: touch.primary }}
          />
          <Button
            testID={`approval-decline-${item.actionId}`}
            variant="secondary"
            label={t('cards.approvals.decline')}
            onPress={() => setReasonOpen(true)}
            style={{ alignSelf: 'stretch', minHeight: touch.primary }}
          />
        </View>
      )}
    </View>
  );
}

function ApprovalsCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const shape = card as unknown as ApprovalsCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.approvals.title')} empty={items.length === 0}>
      {items.map((item, i) => (
        <ApprovalRow key={item.actionId} item={item} separator={i < items.length - 1} />
      ))}
    </ListCard>
  );
}

const DIGEST_ICON: Record<string, LucideIcon> = {
  approval_waiting: ShieldAlert,
  received: ArrowDownLeft,
  bill_due: Zap,
  request: Users,
  anomaly: TrendingUp,
  guardian_notice: ShieldCheck,
};

/** digest — the proactive greeting's rows. Order comes from the backend
 *  (approvals first, spec §4); this only renders and hands the one-tap intent
 *  straight back to the conversation. */
function DigestCardView({ card, onChipTap }: Props) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const bi = useBilingual();
  const shape = card as unknown as DigestCardShape;
  const items = shape.items ?? [];
  return (
    <ListCard title={t('cards.digest.title')} empty={items.length === 0}>
      {items.map((item, i) => {
        const Icon = DIGEST_ICON[item.kind] ?? Sparkles;
        const intent = item.intent ? bi(item.intent) : undefined;
        return (
          <ListRow
            key={`${item.kind}-${item.refId ?? i}`}
            testID={`digest-${item.kind}-${item.refId ?? i}`}
            left={
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={c.ink2} strokeWidth={2.2} />
              </View>
            }
            // Rendered as a node (not a string) so ListRow's default
            // numberOfLines={1} doesn't apply — a digest title ("K-Electric
            // bill is due Sep 10 — ₨4,500") is longer than a typical row
            // title and needs the second line instead of truncating.
            title={<Text variant="hl" numberOfLines={2}>{bi(item.title)}</Text>}
            subtitle={item.subtitle ? bi(item.subtitle) : undefined}
            right={item.amountPaisa != null ? <Text variant="hl">{ltrIsolate(formatPaisa(item.amountPaisa))}</Text> : undefined}
            showChevron={!!intent}
            separator={i < items.length - 1}
            style={{ minHeight: touch.min }}
            onPress={intent ? () => onChipTap?.(intent) : undefined}
          />
        );
      })}
    </ListCard>
  );
}

/** guardian — the trusted-contact state. Read-only by design: every CHANGE needs a
 *  PIN, and the PIN for a guardian change is only ever typed in Settings (spec §4). */
function GuardianCardView({ card }: { card: ChatCard }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const shape = card as unknown as GuardianCardShape;
  // Branches per change (set / remove / raise, plus the backend's `replace` when a
  // guardian card is built from GET /guardian) and renders the ceiling a raise is
  // going TO — a single shared line used to print "₨0" for a removal.
  const pendingLine = guardianPendingLine(
    shape.pendingChange,
    shape.ceilingPaisa,
    t,
    (paisa) => ltrIsolate(formatPaisa(paisa)),
  );

  return (
    <CardShell style={{ gap: space.m }}>
      <View style={{ alignItems: 'center', gap: space.s }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: shape.name ? c.greenTint : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} color={shape.name ? c.green : c.ink3} strokeWidth={2.4} />
        </View>
        <Text variant="hl" center>{shape.name ?? t('guardian.none')}</Text>
        {shape.phone ? <Text variant="foot" center>{ltrIsolate(shape.phone)}</Text> : null}
        <Text variant="sub" center>{t('guardian.ceiling', { amount: ltrIsolate(formatPaisa(shape.ceilingPaisa)) })}</Text>
          {pendingLine ? <Text testID="guardian-card-pending" variant="foot" center color={c.amberDeep}>{pendingLine}</Text> : null}
      </View>
      <Button
        testID="guardian-manage"
        variant="secondary"
        label={t('guardian.manage')}
        icon={<SettingsIcon size={20} color={c.ink} strokeWidth={2} />}
        onPress={() => router.push('/settings')}
        style={{ alignSelf: 'stretch' }}
      />
    </CardShell>
  );
}

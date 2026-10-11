import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { takeAction, markActionDone } from '../../src/store/pendingActionHolder';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useCancelActionMutation, useExecuteActionMutation, apiErr } from '../../src/api/client';
import { actionHead } from '../../src/components/cards/CardView';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import type { Txn } from '../../src/api/types';

/** B3 confirmation head row: a 48 pt cream avatar beside the name. */
const HEAD_AVATAR = 48;
/** Backend line labels already rendered as the big amount / the fee line, so
 *  they are not repeated in the details card. */
const SHOWN_LABELS = new Set(['Amount', 'Fee']);

export default function ConfirmAction() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const action = takeAction(actionId!);
  const { openPinSheet } = usePinSheet();
  const [cancel] = useCancelActionMutation();
  const [execute, { isLoading: executingNoPin }] = useExecuteActionMutation();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action) {
    router.back();
    return null;
  }

  const summaryText = urdu ? action.summary.ur : action.summary.en;
  const head = actionHead(action.lines);
  const detailLines = action.lines.filter((l, i) => !(i === 0 && head) && !SHOWN_LABELS.has(l.label.en));
  const feeLine = action.feePaisa > 0
    ? t('confirm.feeTotal', { fee: ltrIsolate(formatPaisa(action.feePaisa)), total: ltrIsolate(formatPaisa(action.amountPaisa + action.feePaisa)) })
    : t('confirm.feeInstant', { fee: ltrIsolate(formatPaisa(0)) });
  const row = { flexDirection: urdu ? 'row-reverse' : 'row' } as const;

  // `transaction` is null for a PIN-gated action that moves no money
  // (card_unfreeze — see PinSheetResolution). The success screen is built
  // around a ref no. and an amount, so there is nothing to show: the action
  // already executed, so just return to where the user came from. In practice
  // card actions are only ever created from chat, which renders a `card` card
  // instead of routing here.
  const goToSuccess = (transaction: Txn | null, extras?: {
    recipientSuggestion?: unknown;
    billerSuggestion?: unknown;
  }) => {
    if (!transaction) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/success',
      params: {
        refNo: transaction.refNo,
        amountPaisa: String(transaction.amountPaisa),
        summary: summaryText,
        // F2: the success screen speaks the outcome, and needs the transaction
        // itself (type + counterparty) to word it — the same JSON-through-params
        // hand-off the activity list already uses for /txn/[id].
        txn: JSON.stringify(transaction),
        recipientSuggestion: extras?.recipientSuggestion ? JSON.stringify(extras.recipientSuggestion) : undefined,
        billerSuggestion: extras?.billerSuggestion ? JSON.stringify(extras.billerSuggestion) : undefined,
      },
    });
  };

  const onConfirm = async () => {
    // Actions that don't require a PIN (e.g. pocket moves) execute directly,
    // same as before the PinSheet existed — no sheet UI for a PIN nobody enters.
    if (!action.requiresPin) {
      setError(null);
      try {
        const { transaction } = await execute({ id: action.id }).unwrap();
        markActionDone(action.id);
        goToSuccess(transaction);
      } catch (e) {
        setError(apiErr(e).message);
      }
      return;
    }

    setOpening(true);
    try {
      const { transaction, recipientSuggestion, billerSuggestion } = await openPinSheet(action);
      goToSuccess(transaction, { recipientSuggestion, billerSuggestion });
    } catch {
      // 'cancelled' — the sheet was dismissed; stay on the confirm screen.
    } finally {
      setOpening(false);
    }
  };

  const onCancel = async () => {
    cancel(action.id);
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.xl, paddingVertical: space.xl }}>
        {/* B3 / GLASS-SPEC §5: the summary card — cream avatar + name, the
            sentence being confirmed (Nastaliq keeps its own line height), then
            "Sending" over the amount and the fee line. */}
        <Card style={{ gap: space.l }}>
          {head ? (
            <View style={[row, { alignItems: 'center', gap: space.m }]}>
              <Avatar name={head.name} size={HEAD_AVATAR} bg={c.cream} color={c.navy} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" weight={700} numberOfLines={1}>{head.name}</Text>
                {head.sub ? <Text variant="sub" color={c.ink2} numberOfLines={1}>{ltrIsolate(head.sub)}</Text> : null}
              </View>
            </View>
          ) : null}
          <Text variant="sub" color={c.ink2}>{summaryText}</Text>
          <View style={{ gap: space.xs }}>
            <Text variant="sub" color={c.ink2}>{t('confirm.sending')}</Text>
            <Text variant="money">{ltrIsolate(formatPaisa(action.amountPaisa))}</Text>
            <Text variant="foot" color={c.ink3}>{feeLine}</Text>
          </View>
        </Card>

        {detailLines.length > 0 || action.feePaisa > 0 ? (
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            {detailLines.map((l, i) => (
              <View
                key={i}
                style={[row, {
                  justifyContent: 'space-between', gap: space.s, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: c.separator,
                }]}
              >
                <Text variant="sub">{urdu ? l.label.ur : l.label.en}</Text>
                <Text variant="hl" numberOfLines={1} style={{ flexShrink: 1 }}>{ltrIsolate(l.value)}</Text>
              </View>
            ))}
            <View style={[row, { justifyContent: 'space-between', paddingVertical: 12 }]}>
              <Text variant="hl">{t('confirm.total')}</Text>
              <Text variant="hl">{ltrIsolate(formatPaisa(action.amountPaisa + action.feePaisa))}</Text>
            </View>
          </Card>
        ) : null}

        <View style={[row, { alignItems: 'center', gap: 10, paddingHorizontal: 4 }]}>
          <Lock size={18} color={c.ink3} strokeWidth={2} />
          <Text variant="foot" style={{ flex: 1 }}>{t('confirm.pinFootnote')}</Text>
        </View>

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        <View style={{ gap: 8 }}>
          <Button
            testID="confirm-button"
            label={action.requiresPin ? t('confirm.confirmWithPin') : t('common.confirm')}
            onPress={onConfirm}
            loading={opening || executingNoPin}
          />
          <Button testID="cancel-button" variant="ghost" label={t('common.cancel')} onPress={onCancel} />
        </View>
      </ScrollView>
    </Screen>
  );
}

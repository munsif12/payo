import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { Screen, Text, Card, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { takeAction, markActionDone } from '../../src/store/pendingActionHolder';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useCancelActionMutation, useExecuteActionMutation, apiErr } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';

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

  // `transaction` is null for a PIN-gated action that moves no money
  // (card_unfreeze — see PinSheetResolution). The success screen is built
  // around a ref no. and an amount, so there is nothing to show: the action
  // already executed, so just return to where the user came from. In practice
  // card actions are only ever created from chat, which renders a `card` card
  // instead of routing here.
  const goToSuccess = (transaction: { refNo: string; amountPaisa: number } | null, extras?: {
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
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Text variant="hl" center>{summaryText}</Text>
          <Text variant="money" center style={{ marginTop: 6 }}>{formatPaisa(action.amountPaisa)}</Text>
        </Card>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          {action.lines.map((l, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: c.separator,
              }}
            >
              <Text variant="sub">{urdu ? l.label.ur : l.label.en}</Text>
              <Text variant="hl">{l.value}</Text>
            </View>
          ))}
          {action.feePaisa > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.separator }}>
              <Text variant="sub">{t('common.fee')}</Text>
              <Text variant="hl">{formatPaisa(action.feePaisa)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
            <Text variant="hl">{t('confirm.total')}</Text>
            <Text variant="hl">{formatPaisa(action.amountPaisa + action.feePaisa)}</Text>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
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

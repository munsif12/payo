import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellRing, Clock, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { Screen, Text, Card, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, glassTokens } from '../../src/theme/tokens';
import { takeAction } from '../../src/store/pendingActionHolder';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useActionQuery, useRemindGuardianMutation, useMeQuery, apiErr } from '../../src/api/client';
import type { PendingAction } from '../../src/api/types';
import { claimAutoOpenPin, releaseAutoOpen } from '../../src/components/cards/confirmationPolicy';
import { approvalOutcome, guardianCopy, type ApprovalOutcome } from '../../src/components/cards/guardianPolicy';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';

const REMIND_COOLDOWN_MS = 60_000;

const countdown = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Classic Send's waiting-approval screen — the same contract as the chat
// `waiting_approval` card: poll GET /actions/:id every 3 s while the outcome is
// still `waiting`, open the PIN sheet by itself (exactly once, via the shared
// claimAutoOpenPin guard) when the guardian approves, and explain a decline or
// an expiry instead. No skip path exists.
export default function SendWaiting() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const held = takeAction(actionId!);
  const { openPinSheet } = usePinSheet();
  const { data: me } = useMeQuery();
  const [remind, { isLoading: reminding }] = useRemindGuardianMutation();
  const [outcome, setOutcome] = useState<ApprovalOutcome>('waiting');
  const [reason, setReason] = useState<string | null>(null);
  /** The approved action, kept so a cancelled PIN sheet can be reopened by hand. */
  const [approved, setApproved] = useState<PendingAction | null>(null);
  const [remindedAt, setRemindedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const { data: polled } = useActionQuery(actionId!, {
    pollingInterval: 3000,
    skip: !actionId || outcome !== 'waiting',
  });
  const action = polled ?? held;

  useEffect(() => {
    if (outcome !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [outcome]);

  const routerRef = useRef(router);
  routerRef.current = router;
  const openRef = useRef(openPinSheet);
  openRef.current = openPinSheet;

  const openSheet = useCallback((target: PendingAction) =>
    openRef.current(target)
      .then(({ transaction }) => {
        if (!transaction) { routerRef.current.replace('/(tabs)'); return; }
        routerRef.current.replace({
          pathname: '/success',
          params: {
            refNo: transaction.refNo,
            amountPaisa: String(transaction.amountPaisa),
            summary: urdu ? target.summary.ur : target.summary.en,
          },
        });
      })
      .catch((e: Error) => {
        // 'busy' = no sheet was shown, so give the one auto-open back; 'cancelled'
        // = the user dismissed it, and the Confirm button below is their retry.
        if (e?.message === 'busy') releaseAutoOpen(target.id);
      }), [urdu]);

  useEffect(() => {
    if (!polled || outcome !== 'waiting') return;
    // Expiry is distinguished from a decline here (approvalOutcome): an action that
    // simply ran out of time is `cancelled` too, and must not be reported as the
    // trusted contact having refused it.
    const next = approvalOutcome(polled, Date.now());
    if (next === 'waiting') return;
    setOutcome(next);
    if (next === 'declined') { setReason(polled.approval?.reason ?? null); return; }
    if (next !== 'approved') return;
    setApproved(polled);
    if (claimAutoOpenPin(polled.id, { requiresPin: Boolean(polled.requiresPin), live: true, done: false })) {
      openSheet(polled);
    }
  }, [polled, outcome, openSheet]);

  const leftMs = action ? Date.parse(action.expiresAt) - now : 0;
  useEffect(() => {
    if (outcome === 'waiting' && action && leftMs <= 0) setOutcome('expired');
  }, [outcome, action, leftMs]);

  if (!action) {
    router.back();
    return null;
  }

  const guardianName = me?.user.guardian?.name ?? '';
  /** Named copy when we know who the guardian is, standalone copy otherwise. */
  const gt = (base: string, opts?: Record<string, unknown>) => {
    const { key, name } = guardianCopy(base, guardianName);
    return t(key, { name, ...opts });
  };
  const cooldownLeft = remindedAt ? Math.max(0, REMIND_COOLDOWN_MS - (now - remindedAt)) : 0;

  const onRemind = async () => {
    setError(null);
    try {
      await remind(action.id).unwrap();
      setRemindedAt(Date.now());
    } catch (e) {
      const err = apiErr(e);
      if (err.code === 'REMIND_TOO_SOON') setRemindedAt(Date.now());
      else setError(err.message);
    }
  };

  const settledText = outcome === 'approved'
    ? gt('cards.waiting.approved')
    : outcome === 'expired'
      ? t('cards.waiting.expiredBody')
      : reason
        ? gt('cards.waiting.declinedReason', { reason })
        : gt('cards.waiting.declined');

  // GLASS-SPEC §5: a glass card with a tinted header strip that follows the
  // outcome — amber while the guardian decides, green once approved, red for a
  // decline or an expiry — over the summary and the amount.
  const stripFill = outcome === 'approved' ? c.greenTint : outcome === 'waiting' ? c.amberTint : c.redTint;
  const stripColor = outcome === 'approved' ? c.green : outcome === 'waiting' ? c.amber : c.red;
  const stripLabel = outcome === 'approved'
    ? t('cards.approvals.approved')
    : outcome === 'waiting'
      ? t('send.waiting.label')
      : outcome === 'expired'
        ? t('cards.waiting.expired')
        : t('cards.approvals.declined');
  const StripIcon = outcome === 'approved' ? ShieldCheck : outcome === 'waiting' ? Clock : ShieldAlert;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.s,
              paddingHorizontal: space.xl, paddingVertical: space.m,
              backgroundColor: stripFill,
              borderBottomWidth: glassTokens.line, borderBottomColor: c.separator,
            }}
          >
            <StripIcon size={22} color={stripColor} strokeWidth={2.4} />
            <Text variant="hl" weight={700} color={stripColor} style={{ flex: 1 }}>{stripLabel}</Text>
            {outcome === 'waiting' ? <ActivityIndicator size="small" color={c.amber} /> : null}
          </View>
          <View style={{ padding: space.xl, alignItems: 'center', gap: space.m }}>
            <Text variant="sub" color={c.ink2} center>{urdu ? action.summary.ur : action.summary.en}</Text>
            <Text variant="money">{ltrIsolate(formatPaisa(action.amountPaisa))}</Text>
            {outcome === 'waiting' ? (
              <>
                <Text variant="sub" center>{gt('cards.waiting.body')}</Text>
                <Text testID="send-waiting-countdown" variant="foot" center>
                  {t('cards.waiting.expiresIn', { time: ltrIsolate(countdown(Math.max(0, leftMs))) })}
                </Text>
              </>
            ) : (
              <Text testID="send-waiting-outcome" variant="sub" center color={outcome === 'approved' ? c.green : c.red}>
                {settledText}
              </Text>
            )}
          </View>
        </Card>

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        {outcome === 'waiting' ? (
          <Button
            testID="send-waiting-remind"
            variant="secondary"
            label={cooldownLeft > 0
              ? t('cards.waiting.remindWait', { seconds: Math.ceil(cooldownLeft / 1000) })
              : gt('cards.waiting.remind')}
            icon={<BellRing size={20} color={c.ink} strokeWidth={2} />}
            onPress={onRemind}
            disabled={cooldownLeft > 0}
            loading={reminding}
          />
        ) : outcome === 'approved' ? (
          // No dead end: dismissing the auto-opened sheet leaves an APPROVED send
          // with nothing to tap, so the same call is offered as a button.
          <Button
            testID="send-waiting-confirm"
            label={t('confirm.confirmWithPin')}
            onPress={() => approved && openSheet(approved)}
            disabled={!approved}
          />
        ) : (
          <Button testID="send-waiting-done" label={t('common.done')} onPress={() => router.replace('/(tabs)')} />
        )}
      </View>
    </Screen>
  );
}

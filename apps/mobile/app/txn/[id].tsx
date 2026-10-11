import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, Repeat, Share2 } from 'lucide-react-native';
import { Screen, Text, Card, Button, Avatar, InstitutionLogo, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { useRecipientsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { formatRelativeDay } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { RecipientDto, Txn } from '../../src/api/types';

/** B27: a 96 pt cream avatar at the top of the receipt card. */
const RECEIPT_AVATAR = 96;
/** B27: the amount runs at 44/800. */
const AMOUNT_SIZE = 44;
const AMOUNT_LINE_HEIGHT = 52;

/** v8 Urdu QA: an outgoing send carries no `urduName` — the backend writes the
 *  recipient's title + identifier only (transferExecutors.ts) — so the saved
 *  recipient is looked up by identifier (then by title) and the receipt names
 *  the person the way the user says it in Urdu (urduNickname, else urduTitle). */
function urduCounterpartyName(txn: Txn, recipients: RecipientDto[] | undefined): string | undefined {
  if (txn.counterparty.urduName) return txn.counterparty.urduName;
  const r = recipients?.find((x) => x.identifier === txn.counterparty.detail)
    ?? recipients?.find((x) => x.title === txn.counterparty.name);
  return r?.urduNickname || r?.urduTitle || undefined;
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{
      flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.m,
      paddingVertical: space.m, borderBottomWidth: last ? 0 : glassTokens.line, borderBottomColor: c.separator,
    }}>
      <Text variant="body" color={c.ink2}>{label}</Text>
      <Text variant="hl" weight={600} color={c.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

// Receipt — GLASS-SPEC §5 B27. Glass back button + "Receipt" with the reference
// as the sub-line; one glass card: cream avatar (or the institution's mark),
// "Sent to …" 20/700, the amount 44/800 (red out / green in), the green
// Completed pill, then the detail rows. Below: Share (glass, still coming soon)
// and, for a send, "Send again" which reopens the send flow for that person.
export default function Receipt() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const txn: Txn = JSON.parse(data!);
  // Only Urdu needs the recipient lookup (see urduCounterpartyName).
  const { data: recipients } = useRecipientsQuery(undefined, { skip: !urdu });

  const name = (urdu ? urduCounterpartyName(txn, recipients?.items) : undefined) ?? txn.counterparty.name;
  const sign = txn.direction === 'in' ? '+' : '−';
  const amountColor = txn.direction === 'in' ? c.green : c.red;
  const amount = sign + formatPaisa(txn.amountPaisa);
  const headline = txn.direction === 'in'
    ? t('activity.receivedFrom', { name })
    : t('activity.sentTo', { name });
  const canSendAgain = txn.direction === 'out' && (txn.type === 'p2p' || txn.type === 'bank_transfer');

  return (
    <Screen>
      <BackHeader testID="receipt-back" title={t('activity.receipt')} sub={ltrIsolate(txn.refNo)} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}>
        <Card style={{ gap: space.l }}>
          <View style={{ alignItems: 'center', gap: space.m }}>
            {txn.counterparty.institutionLogoUrl ? (
              <View style={{ width: RECEIPT_AVATAR, height: RECEIPT_AVATAR, borderRadius: RECEIPT_AVATAR / 2, backgroundColor: c.cream, alignItems: 'center', justifyContent: 'center' }}>
                <InstitutionLogo size={40} shape="circle" name={txn.counterparty.name} logoUrl={txn.counterparty.institutionLogoUrl} />
              </View>
            ) : (
              // Initials from the Latin name so the disc reads "AB" in both languages.
              <Avatar name={txn.counterparty.name} size={RECEIPT_AVATAR} bg={c.cream} color={c.navy} />
            )}
            <Text variant="h2" color={c.ink} center style={{ fontSize: 20, lineHeight: urdu ? undefined : 26 }}>{headline}</Text>
            <Text variant="money" color={amountColor} center style={{ fontSize: AMOUNT_SIZE, lineHeight: AMOUNT_LINE_HEIGHT }}>
              {ltrIsolate(amount)}
            </Text>
            <Pill
              label={t('activity.completed')}
              bg={c.greenTint}
              color={c.green}
              height={32}
              icon={<Check size={14} color={c.green} strokeWidth={3} />}
            />
          </View>

          <View>
            <DetailRow label={t('activity.date')} value={formatRelativeDay(txn.createdAt, new Date(), urdu ? 'ur' : 'en')} />
            <DetailRow label={t('activity.to')} value={name} />
            <DetailRow label={t('activity.category')} value={txnCategoryLabel(txn.type, t)} />
            <DetailRow label={t('common.fee')} value={ltrIsolate(formatPaisa(txn.feePaisa))} />
            <DetailRow label={t('activity.refNo')} value={ltrIsolate(txn.refNo)} last />
          </View>
        </Card>

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.m }}>
          <Button
            testID="receipt-save"
            variant="secondary"
            label={t('statements.share')}
            icon={<Share2 size={20} color={c.ink} strokeWidth={2} />}
            onPress={() => {}}
            disabled
            style={{ flex: 1 }}
          />
          {canSendAgain ? (
            <Button
              testID="receipt-send-again"
              variant="secondary"
              label={t('activity.sendAgain')}
              icon={<Repeat size={20} color={c.ink} strokeWidth={2} />}
              onPress={() => router.push({ pathname: '/send', params: { q: txn.counterparty.name } })}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        <Text variant="foot" center>{t('common.comingSoon')}</Text>
      </ScrollView>
    </Screen>
  );
}

function txnCategoryLabel(type: Txn['type'], t: (k: string) => string): string {
  switch (type) {
    case 'bill': return t('activity.filter.bills');
    case 'recharge': return t('activity.filter.recharge');
    case 'pocket_deposit':
    case 'pocket_withdraw':
      return t('activity.filter.savings');
    default:
      return t('activity.filter.transfer');
  }
}

/** Stack-screen header: a 44 pt round glass back button, the 28/800 title and a sub-line. */
function BackHeader({ testID, title, sub, onBack }: { testID: string; title: string; sub?: string; onBack: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        style={{ width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="h1" weight={800} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 34 }}>{title}</Text>
        {sub ? <Text variant="sub" color={c.ink2} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

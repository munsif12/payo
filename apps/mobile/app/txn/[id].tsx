import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Check, Download } from 'lucide-react-native';
import { Screen, Text, Card, Button, Avatar, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import type { Txn } from '../../src/api/types';

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{
      flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.separator,
    }}>
      <Text variant="sub">{label}</Text>
      <Text variant="hl">{value}</Text>
    </View>
  );
}

export default function Receipt() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const txn: Txn = JSON.parse(data!);

  const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
  const sign = txn.direction === 'in' ? '+' : '−';
  const amountColor = txn.direction === 'in' ? c.green : c.ink;
  const headline = txn.direction === 'in'
    ? t('activity.receivedFrom', { name })
    : t('activity.sentTo', { name });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="receipt-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{t('activity.receipt')}</Text>
      </View>

      <View style={{ alignItems: 'center', gap: 10, paddingBottom: space.l }}>
        <Avatar name={name} size={64} />
        <Text variant="hl">{headline}</Text>
        <Text variant="money" color={amountColor}>{ltrIsolate(sign + formatPaisa(txn.amountPaisa))}</Text>
        <Pill
          label={t('activity.completed')}
          bg={c.greenTint}
          color={c.green}
          icon={<Check size={14} color={c.green} strokeWidth={3} />}
        />
      </View>

      <Card padding={0} style={{ paddingHorizontal: space.l }}>
        <DetailRow label={t('activity.date')} value={new Date(txn.createdAt).toLocaleString()} />
        <DetailRow label={t('activity.to')} value={name} />
        <DetailRow label={t('common.fee')} value={ltrIsolate(formatPaisa(txn.feePaisa))} />
        <DetailRow label={t('activity.category')} value={txnCategoryLabel(txn.type, t)} />
        <DetailRow label={t('activity.refNo')} value={ltrIsolate(txn.refNo)} last />
      </Card>

      <View style={{ height: space.l }} />
      <Button testID="receipt-save" variant="secondary" label={t('activity.saveReceipt')} icon={<Download size={20} color={c.ink2} strokeWidth={2} />} onPress={() => {}} disabled />
      <Text variant="foot" center style={{ marginTop: space.s }}>{t('common.comingSoon')}</Text>
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

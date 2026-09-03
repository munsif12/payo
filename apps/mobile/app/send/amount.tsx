import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, StickyNote } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, Chip, Input, Keypad, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useCreateTransferMutation, useContactsQuery, useMeQuery, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';

const QUICK_RS = [500, 1000, 2000, 5000];

export default function SendAmount() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const { to, label } = useLocalSearchParams<{ to: string; label: string }>();
  const [rupees, setRupees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createTransfer, { isLoading }] = useCreateTransferMutation();
  const { data: contacts } = useContactsQuery();
  const { data: me } = useMeQuery();

  const parsedTo = useMemo(() => {
    try { return JSON.parse(to ?? '{}') as Record<string, unknown>; } catch { return {}; }
  }, [to]);

  const subtitle = useMemo(() => {
    if (parsedTo.kind === 'payo') return `PAYO · ${String(parsedTo.phone ?? '')}`;
    if (parsedTo.kind === 'contact') {
      const match = contacts?.items.find((ctc) => ctc.id === parsedTo.contactId);
      return match?.phone ? `PAYO · ${match.phone}` : t('send.title');
    }
    return t('send.chips.bank');
  }, [parsedTo, contacts, t]);

  const amountPaisa = Number(rupees || '0') * 100;
  const availablePaisa = me?.account.balancePaisa ?? 0;

  const submit = async () => {
    setError(null);
    try {
      const action = await createTransfer({ to: parsedTo, amountPaisa, note: note.trim() || undefined }).unwrap();
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      const { code, message } = apiErr(e);
      setError(code === 'RECIPIENT_NOT_FOUND' ? t('send.recipientNotFound') : message);
    }
  };

  const onDigit = (d: string) => setRupees((r) => (r + d).replace(/^0+(?=\d)/, '').slice(0, 7));
  const onBackspace = () => setRupees((r) => r.slice(0, -1));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="amount-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('send.amount.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Card padding={space.m} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l }}>
          <Avatar name={label ?? ''} />
          <View style={{ flex: 1 }}>
            <Text variant="hl" numberOfLines={1}>{label}</Text>
            <Text variant="foot" numberOfLines={1}>{subtitle}</Text>
          </View>
          <Pressable testID="amount-change" onPress={() => router.back()} hitSlop={8}>
            <Text variant="sub" weight={600} color={c.amberDeep}>{t('send.amount.change')}</Text>
          </Pressable>
        </Card>

        <View style={{ alignItems: 'center', paddingTop: space.m }}>
          <Text variant="cap">{t('send.amount.youSend')}</Text>
          <Text
            variant="money"
            style={{ fontSize: 52, lineHeight: 60, letterSpacing: -1.5, marginTop: 6 }}
            color={amountPaisa > 0 ? c.ink : c.ink3}
          >
            {formatPaisa(amountPaisa)}
          </Text>
          <Text variant="foot" style={{ marginTop: 6 }}>
            {t('send.amount.available', { amount: formatPaisa(availablePaisa) })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {QUICK_RS.map((rs) => (
            <Chip key={rs} testID={`amount-quick-${rs}`} label={formatPaisa(rs * 100)} selected={rupees === String(rs)} onPress={() => setRupees(String(rs))} />
          ))}
        </View>

        <Input
          testID="amount-note"
          icon={<StickyNote size={18} color={c.ink3} strokeWidth={2} />}
          placeholder={t('send.amount.note')}
          value={note}
          onChangeText={setNote}
        />

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        <Keypad onDigit={onDigit} onBackspace={onBackspace} disabled={isLoading} />

        <Button testID="amount-next" label={t('common.next')} onPress={submit} disabled={amountPaisa <= 0} loading={isLoading} />
      </ScrollView>
    </Screen>
  );
}

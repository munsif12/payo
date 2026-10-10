import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, StickyNote } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, Chip, Input, Keypad, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { useCreateTransferMutation, useMeQuery, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { maskIdentifier } from '../../src/lib/mask';
import { ltrIsolate } from '../../src/lib/bidi';

const QUICK_RS = [500, 1000, 2000, 5000];
/** B18: the amount at 48/800 — larger than the `money` variant's 40. */
const AMOUNT_SIZE = 48;
const AMOUNT_LINE_HEIGHT = 56;

/** GLASS-SPEC §5 B18: the 44 pt round glass back button in the head. */
function BackButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={{
        width: touch.min, height: touch.min, borderRadius: touch.min / 2,
        backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

export default function SendAmount() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const {
    recipientId, institutionId, identifier, title, institutionName, institutionUrduName,
  } = useLocalSearchParams<{
    recipientId?: string; institutionId?: string; identifier: string; title: string;
    institutionName: string; institutionUrduName?: string;
  }>();
  const [rupees, setRupees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createTransfer, { isLoading }] = useCreateTransferMutation();
  const { data: me } = useMeQuery();

  const institutionLabel = urdu && institutionUrduName ? institutionUrduName : institutionName;
  const subtitle = ltrIsolate(`${institutionLabel} · ${maskIdentifier(identifier ?? '')}`);

  const amountPaisa = Number(rupees || '0') * 100;
  const availablePaisa = me?.account.balancePaisa ?? 0;

  const submit = async () => {
    setError(null);
    try {
      const to = recipientId ? { recipientId } : { institutionId: institutionId ?? '', identifier: identifier ?? '' };
      const action = await createTransfer({ to, amountPaisa, note: note.trim() || undefined }).unwrap();
      holdAction(action);
      // v6 gates, in the order the backend applies them (spec §1 rules 8-10):
      // an unanswered check-in comes before everything, then the guardian's
      // approval, and only then the normal confirm + PIN screen.
      if (action.riskFlags?.length && !action.checkIn?.answered) {
        router.push({ pathname: '/send/check-in', params: { actionId: action.id } });
        return;
      }
      if (action.approval?.status === 'waiting') {
        router.push({ pathname: '/send/waiting', params: { actionId: action.id } });
        return;
      }
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      const { code, message } = apiErr(e);
      setError(code === 'RECIPIENT_NOT_FOUND' ? t('send.errors.recipientNotFound') : message);
    }
  };

  const onDigit = (d: string) => setRupees((r) => (r + d).replace(/^0+(?=\d)/, '').slice(0, 7));
  const onBackspace = () => setRupees((r) => r.slice(0, -1));

  return (
    <Screen>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <BackButton testID="amount-back" onPress={() => router.back()} />
        <Text variant="h1" style={{ flex: 1 }}>{t('send.amount.howMuch')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        {/* B18: the recipient as a cream-avatar chip on a glass card. */}
        <Card padding={space.m} style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l }}>
          <Avatar name={title ?? ''} bg={c.cream} color={c.navy} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="hl" weight={700} numberOfLines={1}>{title}</Text>
            <Text variant="foot" color={c.ink2} numberOfLines={1}>{subtitle}</Text>
          </View>
          <Pressable testID="amount-change" accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text variant="sub" weight={600} color={c.amber}>{t('send.amount.change')}</Text>
          </Pressable>
        </Card>

        <View style={{ alignItems: 'center', paddingTop: space.s }}>
          <Text variant="cap">{t('send.amount.youSend')}</Text>
          {/* `money` is always LTR; the string is Latin-only so it never takes the Urdu face. */}
          <Text
            variant="money"
            style={{ fontSize: AMOUNT_SIZE, lineHeight: AMOUNT_LINE_HEIGHT, marginTop: 6 }}
            color={amountPaisa > 0 ? c.ink : c.ink3}
          >
            {formatPaisa(amountPaisa)}
          </Text>
          <Text variant="foot" color={c.ink3} center style={{ marginTop: 6 }}>
            {t('send.amount.available', { amount: ltrIsolate(formatPaisa(availablePaisa)) })}
          </Text>
        </View>

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
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

        <Button testID="amount-next" label={t('common.continue')} onPress={submit} disabled={amountPaisa <= 0} loading={isLoading} />
      </ScrollView>
    </Screen>
  );
}

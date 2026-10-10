import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, StickyNote } from 'lucide-react-native';
import { Screen, Text, Card, Input, ListRow, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { useRecipientsQuery, useCreateRequestMutation, apiErr } from '../../src/api/client';
import { ltrIsolate } from '../../src/lib/bidi';

// Request money — GLASS-SPEC §5 B23: the people you can ask as glass rows with
// cream avatars (an amber check on the chosen one), then a glass form.
export default function NewRequest() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [phone, setPhone] = useState('+92');
  const [rupees, setRupees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: recipients } = useRecipientsQuery();
  const [createRequest, { isLoading }] = useCreateRequestMutation();
  const payoRecipients = (recipients?.items ?? []).filter((r) => r.linkedUserId);
  const rowDir = urdu ? 'row-reverse' : 'row';

  const submit = async () => {
    setError(null);
    try {
      await createRequest({ fromPhone: phone, amountPaisa: Number(rupees) * 100, note: note || undefined }).unwrap();
      router.back();
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="request-new-back"
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface,
            borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={22} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" numberOfLines={1}>{t('requests.new')}</Text>
          <Text variant="sub" numberOfLines={1}>{t('requests.fromWhom')}</Text>
        </View>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        {payoRecipients.length ? (
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            {payoRecipients.map((r, i) => {
              const selected = phone === r.identifier;
              return (
                <ListRow
                  key={r.id}
                  testID={`request-recipient-${r.id}`}
                  onPress={() => setPhone(r.identifier)}
                  left={<Avatar name={r.nickname} bg={c.cream} color={c.navy} />}
                  title={r.nickname}
                  subtitle={ltrIsolate(r.identifier)}
                  right={selected ? <Check size={22} color={c.amber} strokeWidth={2.6} /> : null}
                  separator={i < payoRecipients.length - 1}
                />
              );
            })}
          </Card>
        ) : null}

        <Card padding={space.l} style={{ gap: space.m }}>
          <Input testID="request-phone" placeholder={t('requests.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input testID="request-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
          <Input
            testID="request-note"
            icon={<StickyNote size={18} color={c.ink3} strokeWidth={2} />}
            placeholder={t('common.note')}
            value={note}
            onChangeText={setNote}
          />
        </Card>
        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
        <Button
          testID="request-submit"
          label={t('requests.new')}
          onPress={submit}
          disabled={!/^\+92\d{10}$/.test(phone) || !(Number(rupees) > 0)}
          loading={isLoading}
        />
      </ScrollView>
    </Screen>
  );
}

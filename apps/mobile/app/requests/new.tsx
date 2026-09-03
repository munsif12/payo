import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, StickyNote } from 'lucide-react-native';
import { Screen, Text, Input, ListRow, Avatar, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useRecipientsQuery, useCreateRequestMutation, apiErr } from '../../src/api/client';

export default function NewRequest() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState('+92');
  const [rupees, setRupees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: recipients } = useRecipientsQuery();
  const [createRequest, { isLoading }] = useCreateRequestMutation();
  const payoRecipients = (recipients?.items ?? []).filter((r) => r.linkedUserId);

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="request-new-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('requests.new')}</Text>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Text variant="sub">{t('requests.fromWhom')}</Text>
        {payoRecipients.map((r) => (
          <ListRow
            key={r.id}
            testID={`request-recipient-${r.id}`}
            onPress={() => setPhone(r.identifier)}
            left={<Avatar name={r.nickname} bg={phone === r.identifier ? c.amberTint : c.surface2} color={phone === r.identifier ? c.onAmber : c.ink2} />}
            title={r.nickname}
            subtitle={r.identifier}
          />
        ))}
        <Input testID="request-phone" placeholder={t('requests.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Input testID="request-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
        <Input
          testID="request-note"
          icon={<StickyNote size={18} color={c.ink3} strokeWidth={2} />}
          placeholder={t('common.note')}
          value={note}
          onChangeText={setNote}
        />
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

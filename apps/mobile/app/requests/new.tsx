import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, StickyNote } from 'lucide-react-native';
import { Screen, Text, Input, ListRow, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useContactsQuery, useCreateRequestMutation, apiErr } from '../../src/api/client';

export default function NewRequest() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [phone, setPhone] = useState('+92');
  const [rupees, setRupees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: contacts } = useContactsQuery();
  const [createRequest, { isLoading }] = useCreateRequestMutation();

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
        {(contacts?.items ?? []).filter((ctc) => ctc.kind === 'payo').map((ctc) => (
          <ListRow
            key={ctc.id}
            testID={`request-contact-${ctc.id}`}
            onPress={() => setPhone(ctc.phone!)}
            left={<Avatar name={ctc.name} bg={phone === ctc.phone ? c.amberTint : c.surface2} color={phone === ctc.phone ? c.onAmber : c.ink2} />}
            title={urdu && ctc.urduName ? ctc.urduName : ctc.name}
            subtitle={ctc.phone}
          />
        ))}
        <Input testID="request-phone" placeholder={t('send.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
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

import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, PrimaryButton, ListRow, ErrorBanner, Spacer, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useContactsQuery, useCreateRequestMutation, apiErr } from '../../src/api/client';

export default function NewRequest() {
  const { t } = useTranslation();
  const urdu = useUrdu();
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
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('requests.new')}</T>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <T color={tokens.color.textMuted}>{t('requests.fromWhom')}</T>
        <Spacer h={tokens.space.s} />
        {(contacts?.items ?? []).filter(c => c.kind === 'payo').map(c => (
          <ListRow
            key={c.id}
            onPress={() => setPhone(c.phone!)}
            left={<T size={22}>{phone === c.phone ? '✅' : '👤'}</T>}
            title={<T>{urdu && c.urduName ? c.urduName : c.name}</T>}
            subtitle={c.phone}
          />
        ))}
        <Field testID="request-phone" placeholder={t('send.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Spacer h={tokens.space.s} />
        <Field testID="request-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
        <Spacer h={tokens.space.s} />
        <Field testID="request-note" placeholder={t('common.note')} value={note} onChangeText={setNote} rtl={urdu} />
        <ErrorBanner message={error} />
        <Spacer />
        <PrimaryButton
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

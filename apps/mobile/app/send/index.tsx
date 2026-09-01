import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, PrimaryButton, ListRow, ErrorBanner, Spacer, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useContactsQuery, useBanksQuery, useResolveTitleMutation, apiErr } from '../../src/api/client';

type Mode = 'contacts' | 'phone' | 'bank';

export default function SendPick() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [mode, setMode] = useState<Mode>('contacts');
  const [phone, setPhone] = useState(params.phone ?? '+92');
  const [bankId, setBankId] = useState<string | null>(null);
  const [iban, setIban] = useState('PK');
  const [resolvedTitle, setResolvedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: contacts } = useContactsQuery();
  const { data: banks } = useBanksQuery();
  const [resolveTitle, { isLoading: resolving }] = useResolveTitleMutation();

  const goAmount = (to: Record<string, unknown>, label: string) =>
    router.push({ pathname: '/send/amount', params: { to: JSON.stringify(to), label } });

  const onResolve = async () => {
    setError(null);
    try {
      const { accountTitle } = await resolveTitle({ bankId: bankId!, iban: iban.trim().toUpperCase() }).unwrap();
      setResolvedTitle(accountTitle);
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: 'contacts', label: t('send.contacts') },
    { key: 'phone', label: t('send.newPhone') },
    { key: 'bank', label: t('send.newBank') },
  ];

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('send.title')}</T>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: tokens.space.s, marginBottom: tokens.space.m }}>
        {tabs.map(tb => (
          <PrimaryButtonMini key={tb.key} active={mode === tb.key} label={tb.label} onPress={() => setMode(tb.key)} />
        ))}
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {mode === 'contacts' && (contacts?.items ?? []).map(c => (
          <ListRow
            key={c.id}
            testID={`contact-${c.name.replace(/\s/g, '-')}`}
            onPress={() => goAmount({ kind: 'contact', contactId: c.id }, urdu && c.urduName ? c.urduName : c.name)}
            left={<T size={24}>{c.kind === 'bank' ? '🏦' : '👤'}</T>}
            title={<T>{urdu && c.urduName ? c.urduName : c.name}</T>}
            subtitle={c.kind === 'bank' ? `${c.bankName ?? ''} ${c.iban?.slice(-4) ?? ''}` : c.phone}
          />
        ))}

        {mode === 'phone' && (
          <View>
            <Field testID="send-phone" placeholder={t('send.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Spacer />
            <PrimaryButton
              testID="send-phone-next"
              label={t('common.next')}
              disabled={!/^\+92\d{10}$/.test(phone)}
              onPress={() => goAmount({ kind: 'payo', phone }, phone)}
            />
          </View>
        )}

        {mode === 'bank' && (
          <View>
            <T color={tokens.color.textMuted}>{t('send.chooseBank')}</T>
            <Spacer h={tokens.space.s} />
            {(banks?.items ?? []).map(b => (
              <ListRow
                key={b.id}
                testID={`bank-${b.name.replace(/\s/g, '-')}`}
                onPress={() => { setBankId(b.id); setResolvedTitle(null); }}
                left={<T size={22}>{bankId === b.id ? '✅' : '🏦'}</T>}
                title={<T>{urdu ? b.urduName : b.name}</T>}
              />
            ))}
            <Field testID="send-iban" placeholder={t('send.iban')} autoCapitalize="characters" value={iban} onChangeText={(v) => { setIban(v); setResolvedTitle(null); }} />
            <ErrorBanner message={error} />
            <Spacer />
            {resolvedTitle ? (
              <>
                <ListRow left={<T size={22}>👤</T>} title={<T>{resolvedTitle}</T>} subtitle={t('send.titleResolved')} />
                <PrimaryButton
                  testID="send-bank-next"
                  label={t('common.next')}
                  onPress={() => goAmount({ kind: 'bank', bankId, iban: iban.trim().toUpperCase() }, resolvedTitle)}
                />
              </>
            ) : (
              <PrimaryButton
                testID="send-resolve"
                label={t('send.titleResolved')}
                loading={resolving}
                disabled={!bankId || !/^PK\d{2}[A-Z]{4}\d{16}$/.test(iban.trim().toUpperCase())}
                onPress={onResolve}
              />
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function PrimaryButtonMini({ label, onPress, active }: { label: string; onPress: () => void; active: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <T
        center
        size={tokens.type.caption}
        color={active ? tokens.color.bg : tokens.color.text}
        style={{
          backgroundColor: active ? tokens.color.accent : tokens.color.surface,
          borderRadius: tokens.radius.pill, overflow: 'hidden',
          paddingVertical: tokens.space.s, paddingHorizontal: tokens.space.s,
        }}
        // @ts-expect-error onPress passthrough on Text
        onPress={onPress}
      >
        {label}
      </T>
    </View>
  );
}

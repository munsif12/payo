import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Users, Smartphone, Landmark, Plus } from 'lucide-react-native';
import { Screen, Text, Input, Chip, ListRow, Avatar, Pill, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useContactsQuery, useBanksQuery, useResolveTitleMutation, apiErr } from '../../src/api/client';

type Mode = 'contacts' | 'phone' | 'bank';

export default function SendRecipient() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; q?: string }>();
  const [mode, setMode] = useState<Mode>('contacts');
  const [query, setQuery] = useState(params.q ?? '');
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

  const allContacts = contacts?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allContacts;
    return allContacts.filter((ct) => ct.name.toLowerCase().includes(q) || ct.urduName?.toLowerCase().includes(q));
  }, [allContacts, query]);

  const chips: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: 'contacts', label: t('send.chips.contacts'), icon: <Users size={16} color={mode === 'contacts' ? c.white : c.ink2} strokeWidth={2} /> },
    { key: 'phone', label: t('send.chips.phone'), icon: <Smartphone size={16} color={mode === 'phone' ? c.white : c.ink2} strokeWidth={2} /> },
    { key: 'bank', label: t('send.chips.bank'), icon: <Landmark size={16} color={mode === 'bank' ? c.white : c.ink2} strokeWidth={2} /> },
  ];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="send-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('send.title')}</Text>
      </View>

      <View style={{ flex: 1, gap: space.xl }}>
        <Input
          testID="send-search"
          icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
          placeholder={t('send.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {chips.map((chp) => (
            <Chip key={chp.key} testID={`send-chip-${chp.key}`} label={chp.label} selected={mode === chp.key} onPress={() => setMode(chp.key)} />
          ))}
        </View>

        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode === 'contacts' && (
            <View>
              {filtered.length > 0 ? (
                <>
                  <Text variant="cap" style={{ marginBottom: 4 }}>{t('send.allContacts')}</Text>
                  {filtered.map((ct) => (
                    <ListRow
                      key={ct.id}
                      testID={`contact-${ct.name.replace(/\s/g, '-')}`}
                      onPress={() => goAmount(
                        ct.kind === 'bank'
                          ? { kind: 'bank', bankId: ct.bankId, iban: ct.iban }
                          : { kind: 'contact', contactId: ct.id },
                        ct.name,
                      )}
                      left={<Avatar name={ct.name} />}
                      title={ct.name}
                      subtitle={ct.kind === 'bank' ? `${ct.bankName ?? ''} · ${ct.iban?.slice(-4) ?? ''}` : `PAYO · ${ct.phone}`}
                      right={ct.kind === 'bank' ? <Pill label={t('send.bankPill')} bg={c.surface2} color={c.ink2} /> : undefined}
                      showChevron={ct.kind !== 'bank'}
                    />
                  ))}
                </>
              ) : (
                <Text variant="sub" color={c.ink2} center style={{ marginTop: space.xl }}>{t('send.noMatches')}</Text>
              )}
              <View style={{ marginTop: space.xl }}>
                <Button
                  testID="send-add-new"
                  variant="secondary"
                  label={t('send.addNew')}
                  icon={<Plus size={20} color={c.ink} strokeWidth={2.4} />}
                  onPress={() => setMode('phone')}
                />
              </View>
            </View>
          )}

          {mode === 'phone' && (
            <View style={{ gap: space.l }}>
              <Input
                testID="send-phone"
                placeholder={t('send.phonePlaceholder')}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Button
                testID="send-phone-next"
                label={t('common.next')}
                disabled={!/^\+92\d{10}$/.test(phone)}
                onPress={() => goAmount({ kind: 'payo', phone }, phone)}
              />
            </View>
          )}

          {mode === 'bank' && (
            <View style={{ gap: space.l }}>
              <Text variant="sub" color={c.ink2}>{t('send.chooseBank')}</Text>
              {(banks?.items ?? []).map((b) => (
                <ListRow
                  key={b.id}
                  testID={`bank-${b.name.replace(/\s/g, '-')}`}
                  onPress={() => { setBankId(b.id); setResolvedTitle(null); }}
                  left={<Avatar name={b.name} bg={bankId === b.id ? c.amberTint : c.surface2} color={bankId === b.id ? c.navy : c.ink2} />}
                  title={b.name}
                  showChevron
                />
              ))}
              <Input
                testID="send-iban"
                placeholder={t('send.iban')}
                autoCapitalize="characters"
                value={iban}
                onChangeText={(v) => { setIban(v); setResolvedTitle(null); }}
              />
              {error ? <Text variant="sub" color={c.red}>{error}</Text> : null}
              {resolvedTitle ? (
                <>
                  <ListRow left={<Avatar name={resolvedTitle} />} title={resolvedTitle} subtitle={t('send.titleResolved')} separator={false} />
                  <Button testID="send-bank-next" label={t('common.next')} onPress={() => goAmount({ kind: 'bank', bankId, iban: iban.trim().toUpperCase() }, resolvedTitle)} />
                </>
              ) : (
                <Button
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
      </View>
    </Screen>
  );
}

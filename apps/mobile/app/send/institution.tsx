import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search } from 'lucide-react-native';
import { Screen, Text, Input, ListRow, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useInstitutionsQuery, useResolveRecipientMutation, apiErr } from '../../src/api/client';
import type { InstitutionDto } from '../../src/api/types';

export default function InstitutionPicker() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const [query, setQuery] = useState('');
  const { data } = useInstitutionsQuery(query || undefined);
  const [resolveRecipient, { isLoading: resolving }] = useResolveRecipientMutation();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const popular = useMemo(() => items.filter((i) => i.popular), [items]);
  const rest = useMemo(
    () => [...items.filter((i) => !i.popular)].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const onPick = async (inst: InstitutionDto) => {
    setError(null);
    setResolvingId(inst.id);
    try {
      const resolved = await resolveRecipient({ institutionId: inst.id, identifier: identifier ?? '' }).unwrap();
      router.push({
        pathname: '/send/recipient',
        params: {
          title: resolved.title,
          institutionId: resolved.institution.id,
          institutionName: resolved.institution.name,
          institutionUrduName: resolved.institution.urduName ?? '',
          institutionKind: resolved.institution.kind,
          identifier: resolved.identifier,
          linkedUserId: resolved.linkedUserId ?? '',
        },
      });
    } catch (e) {
      const { code, message } = apiErr(e);
      const key = code === 'RECIPIENT_NOT_FOUND' ? 'send.errors.recipientNotFound'
        : code === 'SELF_TRANSFER' ? 'send.errors.selfTransfer'
        : code === 'INVALID_IDENTIFIER' ? 'send.errors.invalidIdentifier'
        : null;
      setError(key ? t(key) : message);
    } finally {
      setResolvingId(null);
    }
  };

  const renderRow = (inst: InstitutionDto) => (
    <ListRow
      key={inst.id}
      testID={`institution-${inst.name.replace(/\s/g, '-')}`}
      onPress={() => onPick(inst)}
      left={<Avatar name={inst.name} bg={c.amberTint} color={c.onAmber} />}
      title={urdu && inst.urduName ? inst.urduName : inst.name}
      subtitle={resolvingId === inst.id && resolving ? t('common.loading') : undefined}
      showChevron
    />
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="institution-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('send.chooseInstitution')}</Text>
      </View>

      <Input
        testID="institution-search"
        icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
        placeholder={t('send.searchInstitutions')}
        value={query}
        onChangeText={setQuery}
        containerStyle={{ marginBottom: space.l }}
      />

      {error ? <Text variant="sub" color={c.red} center style={{ marginBottom: space.m }}>{error}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
        {popular.length > 0 ? (
          <View style={{ marginBottom: space.l }}>
            <Text variant="cap" style={{ marginBottom: 4 }}>{t('send.popular')}</Text>
            {popular.map(renderRow)}
          </View>
        ) : null}
        {rest.length > 0 ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 4 }}>{t('send.allInstitutions')}</Text>
            {rest.map(renderRow)}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

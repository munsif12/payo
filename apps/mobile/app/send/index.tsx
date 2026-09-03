import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search } from 'lucide-react-native';
import { Screen, Text, Input, ListRow, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useRecipientsQuery, useDeleteRecipientMutation } from '../../src/api/client';
import { maskIdentifier } from '../../src/lib/mask';
import { ltrIsolate } from '../../src/lib/bidi';
import type { RecipientDto } from '../../src/api/types';

export default function SendIdentifier() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; phone?: string }>();
  const [identifier, setIdentifier] = useState(params.phone ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const { data: recipients } = useRecipientsQuery(query || undefined);
  const [deleteRecipient] = useDeleteRecipientMutation();

  const items = useMemo(() => recipients?.items ?? [], [recipients]);
  const numericFriendly = /^[+\d]*$/.test(identifier);

  const goInstitution = () =>
    router.push({ pathname: '/send/institution', params: { identifier: identifier.trim() } });

  const goAmountForRecipient = (r: RecipientDto) =>
    router.push({
      pathname: '/send/amount',
      params: {
        recipientId: r.id,
        title: r.title,
        institutionName: urdu && r.institution.urduName ? r.institution.urduName : r.institution.name,
        identifier: r.identifier,
      },
    });

  const onDelete = (r: RecipientDto) => {
    Alert.alert(
      t('send.saved.deleteTitle'),
      t('send.saved.deleteMessage', { name: r.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteRecipient(r.id) },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="send-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('send.title')}</Text>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.xl, paddingBottom: space.xl }}>
        <View style={{ gap: space.m }}>
          <Input
            testID="send-identifier"
            placeholder={t('send.identifierPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType={numericFriendly ? 'phone-pad' : 'default'}
            value={identifier}
            onChangeText={setIdentifier}
          />
          <Button
            testID="send-identifier-continue"
            label={t('common.continue')}
            disabled={identifier.trim().length < 4}
            onPress={goInstitution}
          />
        </View>

        <View>
          <Text variant="cap" style={{ marginBottom: 4 }}>{t('send.saved.title')}</Text>
          <Input
            testID="send-saved-search"
            icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
            placeholder={t('send.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            containerStyle={{ marginBottom: space.m }}
          />
          {items.length > 0 ? (
            items.map((r) => (
              <ListRow
                key={r.id}
                testID={`saved-recipient-${r.id}`}
                onPress={() => goAmountForRecipient(r)}
                onLongPress={() => onDelete(r)}
                left={<Avatar name={r.nickname} />}
                title={r.nickname}
                subtitle={ltrIsolate(`${r.title} · ${urdu && r.institution.urduName ? r.institution.urduName : r.institution.name} · ${maskIdentifier(r.identifier)}`)}
                showChevron
              />
            ))
          ) : (
            <Text variant="sub" color={c.ink2} center style={{ marginTop: space.l }}>{t('send.saved.empty')}</Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

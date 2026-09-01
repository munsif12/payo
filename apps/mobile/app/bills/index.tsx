import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, ListRow, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useBillersQuery } from '../../src/api/client';

const CAT_EMOJI: Record<string, string> = { electricity: '⚡', gas: '🔥', internet: '🌐', water: '💧' };

export default function Billers() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const { data } = useBillersQuery();

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('bills.title')}</T>
      <ScrollView>
        {(data?.items ?? []).map(b => (
          <ListRow
            key={b.id}
            testID={`biller-${b.name.replace(/\s/g, '-')}`}
            onPress={() => router.push({ pathname: '/bills/[billerId]', params: { billerId: b.id, name: b.name, urduName: b.urduName } })}
            left={<T size={26}>{CAT_EMOJI[b.category ?? ''] ?? '🧾'}</T>}
            title={<T>{urdu ? b.urduName : b.name}</T>}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

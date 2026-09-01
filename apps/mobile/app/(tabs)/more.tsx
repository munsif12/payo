import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Screen, T, ListRow } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { signedOut } from '../../src/store/authSlice';

const ITEMS = [
  { key: 'more.pockets', emoji: '🐖', href: '/pockets' },
  { key: 'more.card', emoji: '💳', href: '/card' },
  { key: 'more.statements', emoji: '📄', href: '/statements' },
  { key: 'more.profile', emoji: '👤', href: '/profile' },
] as const;

export default function More() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('more.title')}</T>
      <ScrollView>
        {ITEMS.map(i => (
          <ListRow
            key={i.key}
            testID={`more-${i.href.slice(1)}`}
            onPress={() => router.push(i.href)}
            left={<T size={26}>{i.emoji}</T>}
            title={<T>{t(i.key)}</T>}
          />
        ))}
        <ListRow
          testID="more-logout"
          onPress={() => dispatch(signedOut())}
          left={<T size={26}>🚪</T>}
          title={<T color={tokens.color.danger}>{t('auth.logout')}</T>}
        />
      </ScrollView>
    </Screen>
  );
}

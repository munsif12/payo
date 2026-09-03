import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { PiggyBank, CreditCard, FileText, UserRound, Clock, LogOut } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, ListRow } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { signedOut } from '../../src/store/authSlice';

const ITEMS: { key: string; icon: LucideIcon; href: string }[] = [
  { key: 'more.pockets', icon: PiggyBank, href: '/pockets' },
  { key: 'more.card', icon: CreditCard, href: '/card' },
  { key: 'more.activity', icon: Clock, href: '/activity' },
  { key: 'more.statements', icon: FileText, href: '/statements' },
  { key: 'more.profile', icon: UserRound, href: '/profile' },
];

export default function More() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();

  return (
    <Screen>
      <View style={{ paddingTop: space.l }}>
        <Text variant="h1" style={{ marginBottom: space.s }}>{t('more.title')}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {ITEMS.map(({ key, icon: Icon, href }) => (
            <ListRow
              key={key}
              testID={`more-${href.slice(1)}`}
              onPress={() => router.push(href)}
              left={<Icon size={24} color={c.ink2} strokeWidth={2} />}
              title={t(key)}
              showChevron
            />
          ))}
          <ListRow
            testID="more-logout"
            onPress={() => dispatch(signedOut())}
            left={<LogOut size={24} color={c.red} strokeWidth={2} />}
            title={<Text variant="hl" color={c.red}>{t('auth.logout')}</Text>}
            separator={false}
          />
        </ScrollView>
      </View>
    </Screen>
  );
}

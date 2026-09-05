import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Avatar } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import type { RootState } from '../src/store';
import { ltrIsolate } from '../src/lib/bidi';
import i18n, { applyLanguage } from '../src/i18n';

export default function Profile() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const lang = i18n.language;
  const name = lang === 'ur' && user?.urduName ? user.urduName : user?.name;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="profile-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{t('profile.title')}</Text>
      </View>

      <Card style={{ alignItems: 'center', gap: space.s }}>
        <Avatar name={name ?? '?'} size={64} />
        <Text variant="h2" center>{name}</Text>
        {user?.email ? <Text variant="foot" center>{user.email}</Text> : null}
        {user?.phone ? <Text variant="foot" center>{ltrIsolate(user.phone)}</Text> : null}
      </Card>

      <View style={{ height: space.xl }} />
      <Text variant="cap" style={{ marginBottom: space.s }}>{t('profile.language')}</Text>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {(['ur', 'en'] as const).map((l) => (
          <Pressable
            key={l}
            testID={`lang-${l}`}
            onPress={() => { applyLanguage(l); }}
            style={{
              flex: 1, borderRadius: radius.button, paddingVertical: space.m, alignItems: 'center',
              backgroundColor: lang === l ? c.amber : c.surface,
            }}
          >
            <Text weight={600} color={lang === l ? c.navy : c.ink}>
              {l === 'ur' ? t('profile.urdu') : t('profile.english')}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

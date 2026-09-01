import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Screen, T, Mono, Card, Spacer, Row } from '../src/components/ui';
import { tokens } from '../src/theme/tokens';
import type { RootState } from '../src/store';
import i18n from '../src/i18n';

export default function Profile() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const lang = i18n.language;

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('profile.title')}</T>
      <Card>
        <T size={tokens.type.h2}>{lang === 'ur' && user?.urduName ? user.urduName : user?.name}</T>
        <Mono color={tokens.color.textMuted}>{user?.email}</Mono>
        <Mono color={tokens.color.textMuted}>{user?.phone}</Mono>
      </Card>
      <Spacer />
      <T color={tokens.color.textMuted}>{t('profile.language')}</T>
      <Spacer h={tokens.space.s} />
      <Row gap={tokens.space.s}>
        {(['ur', 'en'] as const).map(l => (
          <Pressable
            key={l}
            testID={`lang-${l}`}
            onPress={() => i18n.changeLanguage(l)}
            style={{
              flex: 1, borderRadius: tokens.radius.button, paddingVertical: tokens.space.m,
              backgroundColor: lang === l ? tokens.color.accent : tokens.color.surface,
              alignItems: 'center',
            }}
          >
            <T color={lang === l ? tokens.color.bg : tokens.color.text}>
              {l === 'ur' ? t('profile.urdu') : t('profile.english')}
            </T>
          </Pressable>
        ))}
      </Row>
    </Screen>
  );
}

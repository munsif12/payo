import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, MoneyText, PrimaryButton, Spacer } from '../src/components/ui';
import { tokens } from '../src/theme/tokens';

export default function Success() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refNo, amountPaisa } = useLocalSearchParams<{ refNo: string; amountPaisa: string }>();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <T size={72}>✅</T>
        <T size={tokens.type.h1} center>{t('success.title')}</T>
        <T center color={tokens.color.textMuted}>{t('success.sent')}</T>
        <Spacer />
        {amountPaisa ? <MoneyText paisa={Number(amountPaisa)} center color={tokens.color.accent} /> : null}
        <Spacer />
        <Mono size={tokens.type.caption} color={tokens.color.textMuted} center>{t('success.refNo')}: {refNo}</Mono>
        <Spacer h={tokens.space.xl} />
        <View style={{ alignSelf: 'stretch' }}>
          <PrimaryButton testID="success-done" label={t('common.done')} onPress={() => router.dismissAll()} />
        </View>
      </View>
    </Screen>
  );
}

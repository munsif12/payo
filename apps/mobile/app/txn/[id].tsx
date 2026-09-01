import React from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, MoneyText, Card, Spacer, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import type { Txn } from '../../src/api/types';

export default function Receipt() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const txn: Txn = JSON.parse(data!);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingVertical: tokens.space.s }}>
        <T size={tokens.type.h1}>{t('activity.receipt')}</T>
        <Pressable testID="receipt-close" onPress={() => router.back()}>
          <T size={tokens.type.h2} color={tokens.color.textMuted}>✕</T>
        </Pressable>
      </Row>
      <Spacer />
      <Card style={{ alignItems: 'center' }}>
        <T size={40}>{txn.direction === 'in' ? '⬇️' : '⬆️'}</T>
        <MoneyText paisa={txn.amountPaisa} color={txn.direction === 'in' ? tokens.color.success : tokens.color.text} center />
        <T color={tokens.color.textMuted} center>
          {urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name}
        </T>
        <Spacer h={tokens.space.l} />
        <View style={{ alignSelf: 'stretch', gap: tokens.space.s }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('activity.refNo')}</T>
            <Mono size={tokens.type.caption}>{txn.refNo}</Mono>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('activity.date')}</T>
            <Mono size={tokens.type.caption}>{new Date(txn.createdAt).toLocaleString()}</Mono>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('activity.type')}</T>
            <Mono size={tokens.type.caption}>{txn.type}</Mono>
          </Row>
          {txn.feePaisa > 0 && (
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('common.fee')}</T>
              <MoneyText paisa={txn.feePaisa} size={tokens.type.caption} />
            </Row>
          )}
        </View>
      </Card>
    </Screen>
  );
}

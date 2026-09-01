import React, { useState } from 'react';
import { View, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, Card, PrimaryButton, Spacer, Row } from '../src/components/ui';
import { tokens } from '../src/theme/tokens';
import { useCardQuery, useFreezeCardMutation } from '../src/api/client';

export default function CardScreen() {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const { data: card } = useCardQuery();
  const [freeze, { isLoading }] = useFreezeCardMutation();

  if (!card) return <Screen><T center color={tokens.color.textMuted}>{t('common.loading')}</T></Screen>;

  const pan = revealed ? card.pan : `•••• •••• •••• ${card.pan.replace(/\s/g, '').slice(-4)}`;

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('card.title')}</T>
      <Card style={{
        backgroundColor: card.frozen ? tokens.color.surfaceRaised : '#12372B',
        minHeight: 200, justifyContent: 'space-between',
      }}>
        <Row style={{ justifyContent: 'space-between' }} rtlAware={false}>
          <T size={tokens.type.h2} color={tokens.color.accent} weight="800">PAYO</T>
          {card.frozen && <T size={tokens.type.caption} color={tokens.color.danger}>{t('card.frozen')} ❄️</T>}
        </Row>
        <Mono size={24} weight="700" style={{ letterSpacing: 2 }}>{pan}</Mono>
        <Row style={{ justifyContent: 'space-between' }} rtlAware={false}>
          <View>
            <T size={tokens.type.caption} color={tokens.color.textMuted}>{t('card.expiry')}</T>
            <Mono>{card.expiry}</Mono>
          </View>
          <View>
            <T size={tokens.type.caption} color={tokens.color.textMuted}>CVV</T>
            <Mono>{revealed ? card.cvv : '•••'}</Mono>
          </View>
        </Row>
      </Card>
      <Spacer />
      <PrimaryButton testID="card-reveal" label={revealed ? t('card.hide') : t('card.reveal')} onPress={() => setRevealed(r => !r)} />
      <Spacer h={tokens.space.s} />
      <Row style={{ justifyContent: 'space-between', backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card, padding: tokens.space.m }}>
        <T>{card.frozen ? t('card.unfreeze') : t('card.freeze')}</T>
        <Switch
          testID="card-freeze"
          value={card.frozen}
          disabled={isLoading}
          onValueChange={(v) => { freeze({ frozen: v }); }}
          trackColor={{ true: tokens.color.accent, false: tokens.color.surfaceRaised }}
        />
      </Row>
    </Screen>
  );
}

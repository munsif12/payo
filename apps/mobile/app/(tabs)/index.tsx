import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, T, MoneyText, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useMeQuery } from '../../src/api/client';

const SUGGESTIONS = [
  { key: 'home.suggestions.payBill', emoji: '🧾' },
  { key: 'home.suggestions.sendMoney', emoji: '💸' },
  { key: 'home.suggestions.statement', emoji: '📄' },
  { key: 'home.suggestions.savings', emoji: '🐖' },
] as const;

export default function VoiceHome() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const [showBalance, setShowBalance] = useState(false);
  const { data: me } = useMeQuery();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingVertical: tokens.space.s }}>
        <T size={tokens.type.h2} color={tokens.color.accent} weight="800">PAYO</T>
        <Pressable testID="balance-pill" onPress={() => setShowBalance(s => !s)}
          style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: tokens.space.s }}>
          {showBalance && me
            ? <MoneyText paisa={me.account.balancePaisa} size={tokens.type.h2} color={tokens.color.accent} />
            : <T size={tokens.type.caption} color={tokens.color.textMuted}>{'₨ •••• — ' + t('home.tapToReveal')}</T>}
        </Pressable>
      </Row>

      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          testID="mic-button"
          style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: tokens.color.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <T size={48}>🎙️</T>
        </Pressable>
        <T style={{ marginTop: tokens.space.l, marginBottom: tokens.space.xl }} center color={tokens.color.textMuted}>
          {t('home.tapToSpeak')}
        </T>

        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.space.m }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.key}
              style={{
                width: '45%', minHeight: tokens.touch.primary * 1.4,
                backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card,
                alignItems: 'center', justifyContent: 'center', padding: tokens.space.m,
              }}
            >
              <T size={26}>{s.emoji}</T>
              <T center>{t(s.key)}</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

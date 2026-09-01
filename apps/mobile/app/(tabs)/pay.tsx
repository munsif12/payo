import React from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';

const TILES = [
  { key: 'pay.send', emoji: '💸', href: '/send' },
  { key: 'pay.qr', emoji: '🔳', href: '/qr' },
  { key: 'pay.bills', emoji: '🧾', href: '/bills' },
  { key: 'pay.recharge', emoji: '📱', href: '/recharge' },
  { key: 'pay.requests', emoji: '🤝', href: '/requests' },
] as const;

export default function PayHub() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('pay.title')}</T>
      <ScrollView>
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: tokens.space.m, justifyContent: 'center' }}>
          {TILES.map(tile => (
            <Pressable
              key={tile.key}
              testID={`pay-tile-${tile.href.slice(1)}`}
              onPress={() => router.push(tile.href)}
              style={{
                width: '45%', minHeight: 110,
                backgroundColor: tokens.color.surface,
                borderRadius: tokens.radius.card,
                alignItems: 'center', justifyContent: 'center', padding: tokens.space.m,
              }}
            >
              <T size={34}>{tile.emoji}</T>
              <T center>{t(tile.key)}</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

import React from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Send, QrCode, Receipt, Smartphone, Handshake } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';

const TILES: { key: string; icon: LucideIcon; href: string }[] = [
  { key: 'pay.send', icon: Send, href: '/send' },
  { key: 'pay.qr', icon: QrCode, href: '/qr' },
  { key: 'pay.bills', icon: Receipt, href: '/bills' },
  { key: 'pay.recharge', icon: Smartphone, href: '/recharge' },
  { key: 'pay.requests', icon: Handshake, href: '/requests' },
];

export default function PayHub() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ paddingTop: space.l }}>
        <Text variant="h1" style={{ marginBottom: space.xl }}>{t('pay.title')}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: space.m, justifyContent: 'center' }}>
            {TILES.map(({ key, icon: Icon, href }) => (
              <Pressable
                key={key}
                testID={`pay-tile-${href.slice(1)}`}
                onPress={() => router.push(href)}
                style={{
                  width: '45%', minHeight: 110,
                  backgroundColor: c.surface,
                  borderRadius: radius.card,
                  alignItems: 'center', justifyContent: 'center', padding: space.m, gap: 8,
                }}
              >
                <Icon size={30} color={c.amberDeep} strokeWidth={2} />
                <Text variant="sub" center>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

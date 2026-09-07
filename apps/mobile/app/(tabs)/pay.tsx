import React, { useState } from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, Send, QrCode, Zap, Smartphone, ArrowDownLeft, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, Input, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, shadow } from '../../src/theme/tokens';

type TileHref = string | { pathname: string; params: Record<string, string> };

const TILES: { key: string; icon: LucideIcon; href: TileHref }[] = [
  { key: 'pay.send', icon: Send, href: '/send' },
  { key: 'pay.savedRecipients', icon: Users, href: '/send' },
  { key: 'pay.qr', icon: QrCode, href: { pathname: '/qr', params: { tab: 'scan' } } },
  { key: 'pay.bills', icon: Zap, href: '/bills' },
  { key: 'pay.recharge', icon: Smartphone, href: '/recharge' },
  { key: 'pay.requests', icon: ArrowDownLeft, href: '/requests' },
];

// Pay.dc.html: title, a 52pt search field, then a 2×3 grid of 104pt tiles
// (radius 20, 40pt amber-tint icon square). The AI bar docked above the tab
// bar is rendered by (tabs)/_layout.tsx, not here.
export default function PayHub() {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSearchSubmit = () => {
    if (!query.trim()) return;
    router.push({ pathname: '/send', params: { q: query.trim() } });
  };

  return (
    <Screen>
      <View style={{ paddingTop: space.l, flex: 1 }}>
        <Text variant="h1" style={{ marginBottom: space.xl }}>{t('pay.title')}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.xl, paddingBottom: space.xl }}>
          <Input
            testID="pay-search"
            icon={<Search size={18} color={c.ink3} strokeWidth={2} />}
            placeholder={t('pay.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
            containerStyle={{ height: 52 }}
          />

          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: space.m }}>
            {TILES.map(({ key, icon: Icon, href }) => (
              <Pressable
                key={key}
                testID={`pay-tile-${key.split('.')[1]}`}
                onPress={() => router.push(href as Parameters<typeof router.push>[0])}
                style={[
                  {
                    width: '47%',
                    height: 104,
                    backgroundColor: c.surface,
                    borderRadius: radius.card,
                    padding: space.l,
                    justifyContent: 'space-between',
                  },
                  dark ? shadow.card.dark : shadow.card.light,
                ]}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={c.navy} strokeWidth={2.2} />
                </View>
                <Text variant="hl" weight={700} style={{ fontSize: 15, lineHeight: 19 }}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

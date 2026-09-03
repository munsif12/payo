import React, { useState } from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, Send, QrCode, Zap, Smartphone, ArrowDownLeft, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, Input, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, shadow } from '../../src/theme/tokens';
import { useContactsQuery } from '../../src/api/client';

type TileHref = string | { pathname: string; params: Record<string, string> };

const TILES: { key: string; icon: LucideIcon; href: TileHref }[] = [
  { key: 'pay.send', icon: Send, href: '/send' },
  { key: 'pay.qr', icon: QrCode, href: { pathname: '/qr', params: { tab: 'scan' } } },
  { key: 'pay.bills', icon: Zap, href: '/bills' },
  { key: 'pay.recharge', icon: Smartphone, href: '/recharge' },
  { key: 'pay.requests', icon: ArrowDownLeft, href: '/requests' },
  { key: 'pay.myQr', icon: Wallet, href: { pathname: '/qr', params: { tab: 'mine' } } },
];

// Recent-people avatar hues cycle through the palette PayHub.dc.html draws
// (blue / amber / green / purple) — the design assigns a distinct tint per
// contact rather than one flat color.
function avatarHue(c: ReturnType<typeof useTheme>['c'], index: number) {
  const hues = [
    { bg: c.avatarBlueTint, color: c.avatarBlue },
    { bg: c.amberTint, color: c.navy },
    { bg: c.greenTint, color: c.green },
    { bg: c.avatarVioletTint, color: c.avatarViolet },
  ];
  return hues[index % hues.length];
}

export default function PayHub() {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data: contacts } = useContactsQuery();

  const recentPeople = (contacts?.items ?? []).filter((ct) => ct.kind === 'payo').slice(0, 4);

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
            icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
            placeholder={t('pay.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
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
                    minHeight: 110,
                    backgroundColor: c.surface,
                    borderRadius: radius.card,
                    padding: space.l,
                    gap: space.m,
                  },
                  dark ? shadow.card.dark : shadow.card.light,
                ]}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={c.navy} strokeWidth={2.2} />
                </View>
                <Text variant="hl">{t(key)}</Text>
              </Pressable>
            ))}
          </View>

          {recentPeople.length > 0 ? (
            <View>
              <Text variant="hl" style={{ marginBottom: 10 }}>{t('pay.recentPeople')}</Text>
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.l }}>
                {recentPeople.map((person, i) => (
                  <Pressable
                    key={person.id}
                    testID={`pay-recent-${person.id}`}
                    onPress={() => router.push({ pathname: '/send/amount', params: { to: JSON.stringify({ kind: 'contact', contactId: person.id }), label: urdu && person.urduName ? person.urduName : person.name } })}
                    style={{ alignItems: 'center', gap: 6, width: 64 }}
                  >
                    <Avatar name={person.name} size={56} {...avatarHue(c, i)} />
                    <Text variant="foot" center numberOfLines={1}>{urdu && person.urduName ? person.urduName : person.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

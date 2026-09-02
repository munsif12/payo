import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Wallet, Send, MoreHorizontal, LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/useTheme';
import { Text } from './Text';

export type TabKey = 'home' | 'wallet' | 'pay' | 'more';

const ITEMS: { key: TabKey; icon: LucideIcon; labelKey: string }[] = [
  { key: 'home', icon: Sparkles, labelKey: 'tabs.home' },
  { key: 'wallet', icon: Wallet, labelKey: 'tabs.wallet' },
  { key: 'pay', icon: Send, labelKey: 'tabs.pay' },
  { key: 'more', icon: MoreHorizontal, labelKey: 'tabs.more' },
];

// TabBar — Main.dc.html .tab/.tabItem/.tabOn: 84pt bar, 4-col grid, 8px icon
// gap, 11px labels, amberDeep active color. Home uses the Sparkles icon (the
// Home tab IS the AI assistant).
export function TabBar({ active, onPress }: { active: TabKey; onPress: (key: TabKey) => void }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.separator,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 24),
        paddingHorizontal: 8,
      }}
    >
      {ITEMS.map(({ key, icon: Icon, labelKey }) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            testID={`tab-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPress(key);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 }}
          >
            <Icon size={24} color={isActive ? c.amberDeep : c.ink3} strokeWidth={isActive ? 2.2 : 2} />
            <Text
              variant="cap"
              weight={600}
              color={isActive ? c.amberDeep : c.ink3}
              style={{ textTransform: 'none', letterSpacing: undefined, fontSize: 11, lineHeight: undefined }}
            >
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

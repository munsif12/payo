import React from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { TabBar, AIBar } from '../../src/ui';
import type { TabKey } from '../../src/ui';

// Derived from Tabs' own `tabBar` prop type so we don't need a direct
// (and possibly export-map-restricted) import of @react-navigation's
// BottomTabBarProps.
type CustomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ROUTE_TO_TAB: Record<string, TabKey> = { index: 'home', wallet: 'wallet', pay: 'pay', more: 'more' };
const TAB_TO_ROUTE: Record<TabKey, string> = { home: 'index', wallet: 'wallet', pay: 'pay', more: 'more' };

// Custom tab bar — Main.dc.html/Wallet.dc.html: the docked AI bar sits 12px
// above the tab bar on Wallet/Pay/More (not Home, which IS the assistant),
// and tapping it always returns to Home.
function CustomTabBar({ state, navigation }: CustomTabBarProps) {
  const router = useRouter();
  const activeRouteName = state.routes[state.index]?.name ?? 'index';
  const active = ROUTE_TO_TAB[activeRouteName] ?? 'home';

  const onPress = (key: TabKey) => {
    const routeName = TAB_TO_ROUTE[key];
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View>
      {active !== 'home' ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <AIBar onPress={() => router.push('/(tabs)')} />
        </View>
      ) : null}
      <TabBar active={active} onPress={onPress} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="pay" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

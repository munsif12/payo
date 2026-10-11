import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar, GlassBackdropScope } from '../../src/ui';
import type { TabKey } from '../../src/ui';
import { orbBus } from '../../src/voice/orbBus';

// Derived from Tabs' own `tabBar` prop type so we don't need a direct
// (and possibly export-map-restricted) import of @react-navigation's
// BottomTabBarProps.
type CustomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ROUTE_TO_TAB: Record<string, TabKey> = { index: 'home', wallet: 'wallet', pay: 'pay', more: 'more' };
const TAB_TO_ROUTE: Record<TabKey, string> = { home: 'index', wallet: 'wallet', pay: 'pay', more: 'more' };

// Custom tab bar — GLASS-SPEC §4 (NAV option 1): the floating glass pill with
// the voice orb in the middle. The old docked AIBar is gone; the orb replaces it.
function CustomTabBar({ state, navigation }: CustomTabBarProps) {
  const activeRouteName = state.routes[state.index]?.name ?? 'index';
  const active = ROUTE_TO_TAB[activeRouteName] ?? 'home';

  const go = (key: TabKey) => {
    const routeName = TAB_TO_ROUTE[key];
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };

  // The nav orb (§3): on Home it toggles the hands-free loop through orbBus.
  // Anywhere else it goes Home and starts — either Home's handler is still
  // registered (the loop starts now) or Home consumes the pending start on focus.
  const onOrbPress = () => {
    const handled = orbBus.press();
    if (!handled || active !== 'home') go('home');
  };

  return <TabBar active={active} onPress={go} onOrbPress={onOrbPress} />;
}

export default function TabsLayout() {
  return (
    // One gradient behind the whole navigator (scene + pill), so nothing seams
    // where the scene ends and the nav begins (§1: the gradient runs behind the nav).
    <GlassBackdropScope>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="wallet" />
        <Tabs.Screen name="pay" />
        <Tabs.Screen name="more" />
      </Tabs>
    </GlassBackdropScope>
  );
}

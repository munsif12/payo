import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { tokens } from '../../src/theme/tokens';

const ICONS: Record<string, string> = { index: '🎙️', activity: '📋', pay: '💸', more: '☰' };

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const urdu = i18n.language === 'ur';
  const label = (key: string) => (
    <Text style={{
      color: tokens.color.textMuted, fontSize: 13,
      fontFamily: urdu ? tokens.type.urduFont : undefined,
      lineHeight: urdu ? 13 * 1.9 : undefined,
    }}>
      {t(key)}
    </Text>
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.color.surface, borderTopColor: tokens.color.surfaceRaised, height: 84, paddingTop: 6 },
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.textMuted,
      }}
    >
      {(['index', 'activity', 'pay', 'more'] as const).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{ICONS[name]}</Text>,
            tabBarLabel: () => label(`tabs.${name === 'index' ? 'home' : name}`),
          }}
        />
      ))}
    </Tabs>
  );
}

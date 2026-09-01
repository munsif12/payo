import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import '../global.css';
import '../src/i18n';
import { tokens } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoNastaliqUrdu: require('../assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.bg } }} />
    </View>
  );
}

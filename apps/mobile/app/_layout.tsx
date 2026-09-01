import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Provider, useDispatch, useSelector } from 'react-redux';
import '../global.css';
import '../src/i18n';
import i18n from '../src/i18n';
import { tokens } from '../src/theme/tokens';
import { store, RootState } from '../src/store';
import { hydrated, loadStoredAuth } from '../src/store/authSlice';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const auth = useSelector((s: RootState) => s.auth);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!auth.hydrated) loadStoredAuth().then((stored) => {
      if (stored?.user?.language) i18n.changeLanguage(stored.user.language);
      dispatch(hydrated(stored));
    });
  }, [auth.hydrated, dispatch]);

  useEffect(() => {
    if (!auth.hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!auth.token && !inAuthGroup) router.replace('/(auth)/login');
    else if (auth.token && inAuthGroup) router.replace('/(tabs)');
  }, [auth.hydrated, auth.token, segments, router]);

  if (!auth.hydrated) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoNastaliqUrdu: require('../assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Provider store={store}>
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.bg } }} />
        </AuthGate>
      </View>
    </Provider>
  );
}

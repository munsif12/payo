import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import { Provider, useDispatch, useSelector } from 'react-redux';
import '../global.css';
import '../src/i18n';
import i18n from '../src/i18n';
import { useTheme } from '../src/theme/useTheme';
import { store, RootState } from '../src/store';
import { hydrated, loadStoredAuth } from '../src/store/authSlice';
import { PinSheetProvider } from '../src/pin/usePinSheet';
import { OutcomeSpeechProvider } from '../src/voice/OutcomeSpeechProvider';

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

    if (auth.token) {
      if (inAuthGroup) router.replace('/(tabs)');
      return;
    }

    // No session token. Steady-state target: phone (nothing in flight) →
    // create-pin (otpToken + new user) → enter-pin (otpToken + returning user).
    // otp.tsx itself is a transient step reached by explicit navigation from
    // phone.tsx before an otpToken exists, so it is deliberately not gated here.
    const target = auth.otpToken
      ? (auth.isNewUser ? '/(auth)/create-pin' : '/(auth)/enter-pin')
      : '/(auth)/phone';

    if (!inAuthGroup) {
      router.replace(target);
      return;
    }

    const current = `/(auth)/${(segments as readonly string[])[1] ?? ''}`;
    const guardedWithoutOtp = (current === '/(auth)/create-pin' || current === '/(auth)/enter-pin') && !auth.otpToken;
    if (guardedWithoutOtp) router.replace('/(auth)/phone');
  }, [auth.hydrated, auth.token, auth.otpToken, auth.isNewUser, segments, router]);

  if (!auth.hydrated) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoNastaliqUrdu: require('../assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Provider store={store}>
      {/* Outside PinSheetProvider: the sheet's own consumers (the chat cards)
          speak the outcome, and the provider only holds the player + the token. */}
      <OutcomeSpeechProvider>
        <PinSheetProvider>
          <RootShell />
        </PinSheetProvider>
      </OutcomeSpeechProvider>
    </Provider>
  );
}

function RootShell() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
      </AuthGate>
    </View>
  );
}

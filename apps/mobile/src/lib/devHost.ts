import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * The machine that serves Metro also serves the backend (:4000) and the AI
 * service (:8000). In Expo Go, `hostUri` is "<that machine's LAN IP>:8081", so a
 * physical phone on the same Wi-Fi reaches the services without any config.
 * Simulators/emulators fall back to their loopback aliases.
 */
export function devHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

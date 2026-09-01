import { Platform } from 'react-native';

// iOS simulator reaches the host on 127.0.0.1; Android emulator via the 10.0.2.2 alias.
export function backendUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  return `http://${host}:4000`;
}

export const apiBase = () => `${backendUrl()}/api/v1`;

import { Platform } from 'react-native';

export function aiUrl(): string {
  if (process.env.EXPO_PUBLIC_AI_URL) return process.env.EXPO_PUBLIC_AI_URL;
  const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  return `http://${host}:8000`;
}

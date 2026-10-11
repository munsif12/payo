import { devHost } from './devHost';

export function aiUrl(): string {
  if (process.env.EXPO_PUBLIC_AI_URL) return process.env.EXPO_PUBLIC_AI_URL;
  return `http://${devHost()}:8000`;
}

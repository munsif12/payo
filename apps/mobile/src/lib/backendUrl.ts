import { devHost } from './devHost';

// iOS simulator reaches the host on 127.0.0.1; Android emulator via the 10.0.2.2 alias.
export function backendUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  return `http://${devHost()}:4000`;
}

export const apiBase = () => `${backendUrl()}/api/v1`;

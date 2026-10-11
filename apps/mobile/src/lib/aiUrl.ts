import { devHost } from './devHost';

export function aiUrl(): string {
  if (process.env.EXPO_PUBLIC_AI_URL) return process.env.EXPO_PUBLIC_AI_URL;
  const host = devHost();
  // A real phone reaches the AI service through the backend's /ai proxy (the Mac
  // firewall lets Node in, not the Python process); simulators go direct.
  return host === '127.0.0.1' || host === '10.0.2.2' ? `http://${host}:8000` : `http://${host}:4000/ai`;
}

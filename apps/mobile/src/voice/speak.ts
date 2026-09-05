import { aiUrl } from '../lib/aiUrl';

/**
 * POST /speak — TTS for a sentence the app already composed, with no conversational
 * turn behind it (spec §4: the Home digest is spoken, not chatted). Returns the
 * relative audio url to hand to useConverse's `playAudio`, or null when the service
 * declined or is unreachable — the digest is a nicety and must never surface an error.
 *
 * The session bearer is sent even though this endpoint touches no account data: the AI
 * service requires it, and an unauthenticated caller must not be able to spend TTS credit.
 */
export async function requestSpeech(
  text: string,
  language: string,
  token: string | null,
): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${aiUrl()}/speak`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: unknown };
    return typeof data?.url === 'string' ? data.url : null;
  } catch {
    return null;
  }
}

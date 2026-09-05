// Pure safety cap for the "speaking" status (v4 spec §2.3). v3 used a flat 4 s
// timeout, which truncated any reply longer than that and re-opened the mic
// mid-sentence. Once the player reports a duration we cap just past it; while
// the duration is unknown we fall back to a generous ceiling.
import { SPEAK_SAFETY_PAD_MS, SPEAK_SAFETY_UNKNOWN_MS } from './loopConfig';

/**
 * @param durationMs playback duration in ms, or null/undefined while unknown.
 * @returns how long to wait before force-clearing the "speaking" status.
 */
export function speakSafetyMs(durationMs?: number | null): number {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return SPEAK_SAFETY_UNKNOWN_MS;
  }
  return durationMs + SPEAK_SAFETY_PAD_MS;
}

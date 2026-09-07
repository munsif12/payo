// The pure half of WordRise (spec §3 WORD_STEP): what the words are and when
// each one starts. Deliberately free of Reanimated / RN imports so the schedule
// is unit-testable on its own — same reason homeGreetingLogic.ts exists.
import { WORD_STEP, D_ENTER } from './config';

/** How far each word travels on its way in. Same 12 pt as every other entrance. */
export const WORD_TRANSLATE_Y = 12;

/** The words the animation schedules. Collapses runs of whitespace. */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** When each word starts, in ms from the screen's first paint. */
export function wordDelays(count: number, offset = 0): number[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => offset + i * WORD_STEP);
}

/** When the last word has finished landing — the offset the sheet settles at. */
export function wordRiseEnd(count: number, offset = 0): number {
  const delays = wordDelays(count, offset);
  return (delays.length ? delays[delays.length - 1] : offset) + D_ENTER;
}

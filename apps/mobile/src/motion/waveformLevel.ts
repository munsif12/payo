// The pure half of Waveform (spec §3 "the waveform is real"): metering dB in,
// bar geometry and a 0..1 level out. No Reanimated / RN imports, so both the
// mapping and the smoothing are unit-testable, and useRecorder can reuse them
// without dragging the UI in.

/** HomeListening.dc.html: 12 bars, 3 pt wide, 3 pt apart, tallest 22 pt. */
export const BAR_COUNT = 12;
export const BAR_WIDTH = 3;
export const BAR_GAP = 3;
export const BAR_MAX_HEIGHT = 22;

/** The bar silhouette from the artboard (6,12,20,10,16,22,8,14,18,6,12,9 px),
 *  as a fraction of BAR_MAX_HEIGHT. `level` scales the whole shape. */
export const BAR_WEIGHTS = [6, 12, 20, 10, 16, 22, 8, 14, 18, 6, 12, 9]
  .map((h) => h / BAR_MAX_HEIGHT);

/** Floor so a silent mic still shows a waveform rather than a flat line. */
export const MIN_SCALE = 0.35;

/** dB the metering floor maps to. expo-audio reports roughly -60…0 dBFS. */
export const METERING_FLOOR_DB = -60;

/**
 * expo-audio metering (dBFS) → a 0…1 level. -60 dB and below is silence, 0 dB is
 * full scale. Anything non-finite (no metering yet) reads as silence.
 */
export function levelFromDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const normalized = (db - METERING_FLOOR_DB) / -METERING_FLOOR_DB;
  return Math.min(1, Math.max(0, normalized));
}

/**
 * One exponential smoothing step between the level we are showing and the level
 * the mic just reported. Metering arrives in coarse polls, so the raw value
 * jumps; this is what makes the bars read as a voice rather than a strobe.
 */
export function smoothLevel(prev: number, next: number, alpha = 0.4): number {
  const from = Number.isFinite(prev) ? Math.min(1, Math.max(0, prev)) : 0;
  const to = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0;
  const a = Math.min(1, Math.max(0, alpha));
  return from + (to - from) * a;
}

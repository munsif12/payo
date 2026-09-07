import { levelFromDb, smoothLevel, BAR_COUNT, BAR_MAX_HEIGHT, METERING_FLOOR_DB } from '../waveformLevel';

test('the artboard geometry is 12 bars up to 22 pt', () => {
  expect(BAR_COUNT).toBe(12);
  expect(BAR_MAX_HEIGHT).toBe(22);
  expect(METERING_FLOOR_DB).toBe(-60);
});

test('levelFromDb maps -60..0 dBFS onto 0..1 and clamps outside it', () => {
  expect(levelFromDb(-60)).toBe(0);
  expect(levelFromDb(-30)).toBeCloseTo(0.5, 5);
  expect(levelFromDb(0)).toBe(1);
  expect(levelFromDb(-160)).toBe(0);
  expect(levelFromDb(12)).toBe(1);
  expect(levelFromDb(NaN)).toBe(0);
});

test('smoothLevel eases from the shown level toward the new sample', () => {
  expect(smoothLevel(0, 1, 0.4)).toBeCloseTo(0.4, 5);
  expect(smoothLevel(0.4, 1, 0.4)).toBeCloseTo(0.64, 5);
  // alpha 1 takes the sample as-is; alpha 0 holds.
  expect(smoothLevel(0.2, 0.9, 1)).toBeCloseTo(0.9, 5);
  expect(smoothLevel(0.2, 0.9, 0)).toBeCloseTo(0.2, 5);
});

test('smoothLevel clamps its inputs to 0..1 and survives garbage', () => {
  expect(smoothLevel(-3, 2, 1)).toBe(1);
  expect(smoothLevel(0.5, NaN, 1)).toBe(0);
  expect(smoothLevel(NaN, 1, 1)).toBe(1);
});

test('repeated smoothing converges on the sample without overshooting', () => {
  let v = 0;
  for (let i = 0; i < 40; i += 1) v = smoothLevel(v, 0.8);
  expect(v).toBeGreaterThan(0.79);
  expect(v).toBeLessThanOrEqual(0.8);
});

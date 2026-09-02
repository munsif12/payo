import {
  RISE_MS,
  STAGGER_MS,
  BREATHE_MS,
  RING_MS,
  DOTS_MS,
  COUNT_MS,
  SHAKE_PX,
  SHAKE_MS,
  PRESS_SCALE,
  PRESS_MS,
  PIN_DOT_MS,
  WAVE_BARS_MS,
  DOTS_OFFSET_MS,
  RING_OFFSET_MS,
  BREATHE_SCALE,
  RING_SCALE_TO,
} from '../config';

// Values pinned to docs/design/revamp-v1/Motion.dc.html — see keyframes block
// and the motion-spec table on that artboard.
test('motion timing constants match Motion.dc.html', () => {
  expect(RISE_MS).toBe(300);
  expect(STAGGER_MS).toBe(60);
  expect(BREATHE_MS).toBe(2400);
  expect(RING_MS).toBe(1800);
  expect(DOTS_MS).toBe(1200);
  expect(COUNT_MS).toBe(250);
  expect(SHAKE_PX).toBe(4);
  expect(SHAKE_MS).toBe(200);
  expect(PRESS_SCALE).toBe(0.98);
  expect(PRESS_MS).toBe(100);
  expect(PIN_DOT_MS).toBe(150);
  expect(WAVE_BARS_MS).toBe(900);
  expect(DOTS_OFFSET_MS).toBe(150);
  expect(RING_OFFSET_MS).toBe(600);
  expect(BREATHE_SCALE).toBe(1.04);
  expect(RING_SCALE_TO).toBe(2.1);
});

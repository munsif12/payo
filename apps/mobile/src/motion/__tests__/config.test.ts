import {
  EASE_OUT, EASE_IN, D_MICRO, D_UI, D_ENTER, D_SHEET,
  STAGGER, WORD_STEP, PRESS_SCALE, RINGS, COUNT_UP, ICON_SWAP,
} from '../config';
import * as config from '../config';

// Values pinned to docs/2026-09-07-payo-v7-ai-first-ui-design.md §3.
test('motion tokens match the v7 motion spec', () => {
  expect(EASE_OUT).toEqual([0.2, 0, 0, 1]);
  expect(EASE_IN).toEqual([0.4, 0, 1, 1]);
  expect(D_MICRO).toBe(150);
  expect(D_UI).toBe(220);
  expect(D_ENTER).toBe(300);
  expect(D_SHEET).toBe(320);
  expect(STAGGER).toBe(60);
  expect(WORD_STEP).toBe(55);
  expect(PRESS_SCALE).toBe(0.96);
  expect(RINGS).toEqual({ duration: 1800, scaleTo: 2.1, opacityFrom: 0.5, offset: 600 });
  expect(COUNT_UP).toBe(250);
  expect(ICON_SWAP).toEqual({ scaleFrom: 0.25 });
});

// The spec makes config.ts the single source: anything else that creeps in here
// is a screen-specific number that belongs at its use site.
test('config exports exactly the v7 token set', () => {
  expect(Object.keys(config).sort()).toEqual([
    'COUNT_UP', 'D_ENTER', 'D_MICRO', 'D_SHEET', 'D_UI',
    'EASE_IN', 'EASE_OUT', 'ICON_SWAP', 'PRESS_SCALE', 'RINGS',
    'STAGGER', 'WORD_STEP',
  ]);
});

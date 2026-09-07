// Motion tokens — the single source for every animation in the app.
// Verbatim from docs/2026-09-07-payo-v7-ai-first-ui-design.md §3 ("Motion spec
// (binding values)"). Nothing here is invented, and nothing else belongs here:
// a number used by exactly one screen lives at that screen's use site.

/** Every entrance. `cubic-bezier(0.2, 0, 0, 1)` — Reanimated `Easing.bezier(...EASE_OUT)`. */
export const EASE_OUT = [0.2, 0, 0, 1] as const;

/** Every exit. `cubic-bezier(0.4, 0, 1, 1)`. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** Press, colour and opacity toggles. */
export const D_MICRO = 150;

/** Icon swaps, chips, small state changes. */
export const D_UI = 220;

/** Element entrance. */
export const D_ENTER = 300;

/** Sheet settle — translateY 24 → 0, no overshoot. */
export const D_SHEET = 320;

/** First-paint row stagger. Never used for list updates. */
export const STAGGER = 60;

/** Greeting words. */
export const WORD_STEP = 55;

/** All pressables. */
export const PRESS_SCALE = 0.96;

/** Listening rings: 1.8 s, scale 1 → 2.1, opacity .5 → 0, second ring 600 ms behind. */
export const RINGS = {
  duration: 1800,
  scaleTo: 2.1,
  opacityFrom: 0.5,
  offset: 600,
} as const;

/** Balance changes, tabular figures. */
export const COUNT_UP = 250;

/** Icon state changes: scale 0.25 → 1 with opacity 0 → 1 over D_UI. */
export const ICON_SWAP = { scaleFrom: 0.25 } as const;

// Motion timing constants — verbatim from docs/design/revamp-v1/Motion.dc.html
// (the shared CSS keyframes block + the motion-spec table). Every motion
// primitive in this folder reads its numbers from here; nothing here is
// invented, and every value below should be traceable to that file.

// Reanimated 4 easing curves used across the spec.
export const EASE_OUT = [0, 0, 0.2, 1] as const; // cubic-bezier(0,0,.2,1) — entrances
export const EASE_INOUT_SPEC = [0.4, 0, 0.2, 1] as const; // cubic-bezier(.4,0,.2,1) — screen transitions / breathe

// Touch feedback: scale 0.98 + shadow drop, restores on release. 100ms ease-out.
export const PRESS_SCALE = 0.98;
export const PRESS_MS = 100;

// Home greeting bubble: opacity 0->1, translateY 12->0.
export const RISE_MS = 300;
export const RISE_TRANSLATE_Y = 12;

// Suggestion cards: same rise, staggered 60ms apart, 5 cards -> ~600ms total.
export const STAGGER_MS = 60;

// Mic idle breathing loop: scale 1 -> 1.04 -> 1.
export const BREATHE_MS = 2400;
export const BREATHE_SCALE = 1.04;

// Listening rings: two (spec table) rendered as three offset classes in the
// artboard CSS (.ringA/.ringB/.ringC); ListeningRings uses a 600ms offset.
export const RING_MS = 1800;
export const RING_SCALE_TO = 2.1;
export const RING_OPACITY_FROM = 0.5;
export const RING_OFFSET_MS = 600;

// Listening waveform bars: 10 bars, scaleY 0.35 -> 1 -> 0.35.
export const WAVE_BARS_MS = 900;
export const WAVE_BAR_COUNT = 10;
export const WAVE_BAR_SCALE_MIN = 0.35;

// Thinking dots: 3 dots, 150ms apart, 3px lift, 1.2s loop.
export const DOTS_MS = 1200;
export const DOTS_OFFSET_MS = 150;
export const DOTS_LIFT_PX = 3;

// Reply + card: text lands, card rises 120ms after.
export const REPLY_TEXT_MS = 300;
export const REPLY_CARD_MS = 350;
export const REPLY_CARD_DELAY_MS = 120;

// Screen transitions: push/pop slide with 30% parallax.
export const SCREEN_TRANSITION_MS = 300;
export const SCREEN_PARALLAX_PCT = 0.3;

// Balance update: digits count up, 1.03 scale settle.
export const COUNT_MS = 250;
export const COUNT_SETTLE_SCALE = 1.03;

// PIN dots: fill amber + scale 1.1->1 on entry; shake 4px/200ms on error.
export const PIN_DOT_MS = 150;
export const PIN_DOT_SCALE = 1.1;
export const SHAKE_PX = 4;
export const SHAKE_MS = 200;

// Confirm sheet: rises from bottom, scrim 0->55%; cancel exits faster.
export const CONFIRM_SHEET_MS = 350;
export const CONFIRM_SCRIM_OPACITY = 0.55;
export const CONFIRM_EXIT_MS = 220;

// Success: check draws/lands first, then amount + ref rise.
export const SUCCESS_CHECK_MS = 400;
export const SUCCESS_TEXT_MS = 300;

// Reanimated spring used for "settle" moments (per Motion.dc.html footer note).
export const SPRING_DAMPING = 18;
export const SPRING_STIFFNESS = 220;

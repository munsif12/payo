// Timing + threshold constants for the hands-free voice loop (v4 spec §2.1).
// Kept in one file so the feel of the conversation can be tuned in a single
// place — nothing else in the app hard-codes these numbers.

/** Mic open, nothing heard yet → close the window. */
export const PRE_SPEECH_TIMEOUT_MS = 6000;
/** Speech heard, then quiet this long → send the clip. */
export const POST_SPEECH_SILENCE_MS = 1200;
/** Peak metering must reach this (dB) for a clip to count as speech. */
export const SPEECH_THRESHOLD_DB = -30;
/** Below this (dB) counts as silence. */
export const SILENCE_DB = -35;
/** Hard cap per clip. */
export const MAX_CLIP_MS = 15000;
/** Gap after playback ends before the mic re-opens (audio tail). */
export const REARM_DELAY_MS = 300;
/** Consecutive no-speech windows before the loop ends itself. */
export const MAX_SILENT_TURNS = 2;
/** Cost guard: automatic turns before the loop pauses itself. The simulator's
 *  mic is the host machine's mic, so ambient room conversation can otherwise
 *  keep the loop alive indefinitely, one Gemini + TTS call per turn. */
export const MAX_AUTO_TURNS = 12;
/** Safety cap while the player duration is still unknown. */
export const SPEAK_SAFETY_UNKNOWN_MS = 30000;
/** Padding added to a known playback duration for the safety cap. */
export const SPEAK_SAFETY_PAD_MS = 1500;

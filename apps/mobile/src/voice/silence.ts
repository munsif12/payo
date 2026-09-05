// Pure decision for "should the recorder keep going or stop now?" (v4 spec §2.2).
// Two timers replace v3's single warm-up rule:
//   • nothing heard yet  → close the window after PRE_SPEECH_TIMEOUT_MS
//   • speech heard       → close it POST_SPEECH_SILENCE_MS after the voice drops
// plus the unchanged MAX_CLIP_MS hard cap. useRecorder just applies the result.
import {
  MAX_CLIP_MS, POST_SPEECH_SILENCE_MS, PRE_SPEECH_TIMEOUT_MS, SILENCE_DB, SPEECH_THRESHOLD_DB,
} from './loopConfig';

export interface SilenceConfig {
  preSpeechTimeoutMs: number;
  postSpeechSilenceMs: number;
  speechThresholdDb: number;
  silenceDb: number;
  maxClipMs: number;
}

export const defaultSilenceConfig: SilenceConfig = {
  preSpeechTimeoutMs: PRE_SPEECH_TIMEOUT_MS,
  postSpeechSilenceMs: POST_SPEECH_SILENCE_MS,
  speechThresholdDb: SPEECH_THRESHOLD_DB,
  silenceDb: SILENCE_DB,
  maxClipMs: MAX_CLIP_MS,
};

export interface SilenceInput {
  /** Now, in ms. */
  now: number;
  /** When the clip started, in ms. */
  startedAt: number;
  /** Current peak metering level in dB. */
  level: number;
  /** Whether speech has already been heard in this clip (latches). */
  hadSpeech: boolean;
  /** When the current run of silence began, or null. */
  silenceSince: number | null;
  cfg?: SilenceConfig;
}

export interface SilenceResult {
  decision: 'continue' | 'stop';
  hadSpeech: boolean;
  silenceSince: number | null;
}

export function silenceDecision(input: SilenceInput): SilenceResult {
  const cfg = input.cfg ?? defaultSilenceConfig;
  const { now, startedAt, level } = input;
  const elapsed = now - startedAt;

  // hadSpeech latches: once the peak crosses the speech threshold it stays true
  // for the rest of the clip, even if the speaker goes quiet again.
  const hadSpeech = input.hadSpeech || level >= cfg.speechThresholdDb;

  if (elapsed >= cfg.maxClipMs) return { decision: 'stop', hadSpeech, silenceSince: input.silenceSince };

  if (!hadSpeech) {
    // Nothing heard yet — only the pre-speech timeout can close the window.
    if (elapsed >= cfg.preSpeechTimeoutMs) return { decision: 'stop', hadSpeech, silenceSince: null };
    return { decision: 'continue', hadSpeech, silenceSince: null };
  }

  if (level < cfg.silenceDb) {
    const silenceSince = input.silenceSince ?? now;
    if (now - silenceSince >= cfg.postSpeechSilenceMs) return { decision: 'stop', hadSpeech, silenceSince };
    return { decision: 'continue', hadSpeech, silenceSince };
  }

  // Still speaking (or at least above the silence floor) — reset the run.
  return { decision: 'continue', hadSpeech, silenceSince: null };
}

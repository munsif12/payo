// Pure Home state machine — which of the three Home faces is showing, what the
// head's sub-line says, and what the orb bus should mirror. No React and no RN
// imports, so the mapping is testable on its own. (Under Direction B the head
// sizes to its content, so there is no per-state height here any more.)
import type { VoiceLoopMode } from '../voice/voiceLoopReducer';
import type { OrbState } from '../voice/orbBus';

export type HomeState = 'greet' | 'listening' | 'conversation';

/** The status the head's sub-line shows for the current voice-loop mode. `none`
 *  falls back to the balance line — the greet head with the loop off. */
export type HeadStatus = 'none' | 'listening' | 'thinking' | 'speaking' | 'paused';

export interface HomeStateInput {
  /** useVoiceLoop's mode. */
  mode: VoiceLoopMode;
  /** useConverse's message count — one message means the conversation has begun. */
  messageCount: number;
  /** useRecorder's `recording` — true for a tap-per-turn clip with the loop off. */
  recording: boolean;
}

/**
 * greet → listening → conversation.
 *
 * Once there is a single message the screen stays in `conversation` for the rest
 * of the session: the transcript is the content, and the head shrinks to its
 * compact form (B3) to give it the room.
 */
export function homeState({ mode, messageCount, recording }: HomeStateInput): HomeState {
  if (messageCount > 0) return 'conversation';
  if (recording || mode === 'listening') return 'listening';
  return 'greet';
}

export function headStatus(mode: VoiceLoopMode, recording: boolean): HeadStatus {
  if (mode === 'off') return recording ? 'listening' : 'none';
  return mode;
}

/** What Home mirrors into `orbBus.setState` so every orb (hero, mini, nav) shows
 *  the same face: `listening` while the mic is open, `live` for the rest of a
 *  conversation (thinking / speaking / paused), `idle` with the loop off. */
export function orbStateFor(mode: VoiceLoopMode, recording: boolean): OrbState {
  if (recording || mode === 'listening') return 'listening';
  return mode === 'off' ? 'idle' : 'live';
}

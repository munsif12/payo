// Pure Home state machine — which of the three Home faces is showing, how tall
// the navy head is, and what the head's status row says. No React and no RN
// imports, so the mapping the artboards fix (Main 316 / HomeListening 350 /
// HomeConversation 230) is testable on its own.
import type { VoiceLoopMode } from '../voice/voiceLoopReducer';

export type HomeState = 'greet' | 'listening' | 'conversation';

/** Navy-head height per state — Main.dc.html / HomeListening.dc.html /
 *  HomeConversation.dc.html. Each artboard draws the navy `SHEET_OVERLAP` (14 pt)
 *  taller than the sheet's top edge, because the sheet's 28 pt corners sit over
 *  it: 330/316, 350/336, 230/216. These are the NAVY heights, so Home's
 *  `marginTop: -SHEET_OVERLAP` lands the sheet on the artboard's top edge. */
export const HEAD_HEIGHT: Record<HomeState, number> = {
  greet: 330,
  listening: 350,
  conversation: 230,
};

/** The status row the head shows for the current voice-loop mode. `none` renders
 *  no row at all — the greet head with the loop off. */
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
 * of the session: the transcript is the content, and the head shrinks to 230 to
 * give it the room (HomeConversation.dc.html).
 */
export function homeState({ mode, messageCount, recording }: HomeStateInput): HomeState {
  if (messageCount > 0) return 'conversation';
  if (recording || mode === 'listening') return 'listening';
  return 'greet';
}

export function headHeight(state: HomeState): number {
  return HEAD_HEIGHT[state];
}

export function headStatus(mode: VoiceLoopMode, recording: boolean): HeadStatus {
  if (mode === 'off') return recording ? 'listening' : 'none';
  return mode;
}

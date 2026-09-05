// Pure state machine for the hands-free voice loop (v4 spec §2.1). No React and
// no RN imports: useVoiceLoop.ts wires this to the recorder/player; this file
// only owns which mode follows which event. Anything not listed in the spec's
// transition table is a no-op that returns the *same* state object, so callers
// can rely on identity to skip re-renders.
import { MAX_AUTO_TURNS, MAX_SILENT_TURNS } from './loopConfig';

export type VoiceLoopMode = 'off' | 'listening' | 'thinking' | 'speaking' | 'paused';

export type VoiceLoopEndReason = 'user' | 'silence' | 'error' | 'typed' | 'left' | 'limit';

export interface VoiceLoopState {
  /** Where the loop is right now. */
  mode: VoiceLoopMode;
  /** Consecutive listening windows that closed with no speech. */
  silentTurns: number;
  /** Turns sent automatically since the conversation started — the cost guard.
   *  At MAX_AUTO_TURNS the reply is still spoken, then the loop pauses itself. */
  autoTurns: number;
  /** Where `resume` returns after `pause`. */
  resumeTo: 'listening' | null;
  /** Why the loop last ended — drives the Home "conversation ended" hint. */
  endedReason: VoiceLoopEndReason | null;
}

export type VoiceLoopEvent =
  | { type: 'start' }
  | { type: 'stop'; reason: 'user' | 'typed' | 'left' }
  | { type: 'sent' }
  | { type: 'noSpeech' }
  | { type: 'audioStarted' }
  | { type: 'audioEnded' }
  | { type: 'turnDone' }
  | { type: 'interrupt' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'error' };

export const initialVoiceLoopState: VoiceLoopState = {
  mode: 'off',
  silentTurns: 0,
  autoTurns: 0,
  resumeTo: null,
  endedReason: null,
};

const LIVE: VoiceLoopMode[] = ['listening', 'thinking', 'speaking', 'paused'];
const isLive = (mode: VoiceLoopMode) => LIVE.includes(mode);

/** A turn finished (spoken reply ended, or a text-only reply). Re-arms the mic
 *  unless the cost guard has been reached — the reply to the MAX_AUTO_TURNS'th
 *  turn is still delivered, and the loop ends after it rather than listening
 *  again. `interrupt` deliberately does not go through here: the user is
 *  actively driving the conversation. */
function endTurn(state: VoiceLoopState): VoiceLoopState {
  if (state.autoTurns >= MAX_AUTO_TURNS) {
    return { ...state, mode: 'off', resumeTo: null, endedReason: 'limit' };
  }
  return { ...state, mode: 'listening' };
}

export function voiceLoopReducer(state: VoiceLoopState, event: VoiceLoopEvent): VoiceLoopState {
  switch (event.type) {
    case 'start':
      if (state.mode !== 'off') return state;
      return { mode: 'listening', silentTurns: 0, autoTurns: 0, resumeTo: null, endedReason: null };

    case 'stop':
      if (!isLive(state.mode)) return state;
      return { ...state, mode: 'off', resumeTo: null, endedReason: event.reason };

    case 'error':
      if (!isLive(state.mode)) return state;
      return { ...state, mode: 'off', resumeTo: null, endedReason: 'error' };

    case 'sent':
      // `off` + sent is the plain tap-per-turn send: the loop stays off.
      if (state.mode !== 'listening') return state;
      return { ...state, mode: 'thinking', silentTurns: 0, autoTurns: state.autoTurns + 1 };

    case 'noSpeech': {
      if (state.mode !== 'listening') return state;
      const silentTurns = state.silentTurns + 1;
      if (silentTurns >= MAX_SILENT_TURNS) {
        return { ...state, mode: 'off', silentTurns, resumeTo: null, endedReason: 'silence' };
      }
      return { ...state, silentTurns };
    }

    case 'audioStarted':
      if (state.mode !== 'thinking') return state;
      return { ...state, mode: 'speaking' };

    case 'turnDone':
      if (state.mode !== 'thinking') return state;
      return endTurn(state);

    case 'audioEnded':
      if (state.mode !== 'speaking') return state;
      return endTurn(state);

    case 'interrupt':
      if (state.mode !== 'speaking') return state;
      return { ...state, mode: 'listening' };

    case 'pause':
      if (state.mode !== 'listening' && state.mode !== 'thinking' && state.mode !== 'speaking') return state;
      return { ...state, mode: 'paused', resumeTo: 'listening' };

    case 'resume':
      if (state.mode !== 'paused') return state;
      return { ...state, mode: state.resumeTo ?? 'listening', resumeTo: null };

    default:
      return state;
  }
}

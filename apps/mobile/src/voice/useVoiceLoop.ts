import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { REARM_DELAY_MS } from './loopConfig';
import {
  initialVoiceLoopState, voiceLoopReducer,
  type VoiceLoopEndReason, type VoiceLoopMode,
} from './voiceLoopReducer';
import type { RecordingResult } from './useRecorder';
import type { ConverseStatus } from './useConverse';

/** Only the parts of useRecorder the loop needs — keeps this hook testable and
 *  free of any expo-audio import. */
export interface VoiceLoopRecorder {
  recording: boolean;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
}

/** Only the parts of useConverse the loop needs. */
export interface VoiceLoopConverse {
  status: ConverseStatus;
  sendAudio: (uri: string) => void;
  sendText: (text: string) => void;
  interrupt: () => void;
}

/** Callbacks the host screen forwards from the recorder / converse hooks.
 *  Both of those are constructed *before* this hook (they own native state), so
 *  the screen wires them through a ref to these stable handlers. */
export interface VoiceLoopHandlers {
  /** A recording finished — sends it only when it actually contains speech. */
  onRecordingFinished: (result: RecordingResult) => void;
  /** useConverse `onSpeechEnd`. */
  onSpeechEnd: () => void;
  /** useConverse `onTurnDone`. */
  onTurnDone: () => void;
  /** useConverse `onError`. */
  onError: () => void;
}

export interface UseVoiceLoopArgs {
  recorder: VoiceLoopRecorder;
  converse: VoiceLoopConverse;
  /** True while the PIN sheet is showing — listening pauses so PIN audio never
   *  reaches the AI service. */
  pinSheetOpen: boolean;
}

export interface UseVoiceLoopResult {
  mode: VoiceLoopMode;
  endedReason: VoiceLoopEndReason | null;
  /** Mic tap while off — goes live. */
  start: () => void;
  /** Ends the conversation (default reason: the user tapped X). */
  stop: (reason?: 'user' | 'typed' | 'left') => void;
  /** Tap on the "Speaking… tap to interrupt" bar. */
  interrupt: () => void;
  /** Typed send: ends the loop (the user changed modality), then sends. */
  onTextSend: (text: string) => void;
  /** Suggestion-card tap: sends but keeps the conversation live. */
  sendSuggestion: (intent: string) => void;
  handlers: VoiceLoopHandlers;
}

/** Owns the hands-free conversation: listen → send → speak → listen again,
 *  until the user ends it, stops replying, types, backgrounds the app, or
 *  leaves the screen (v4 spec §2.4). */
export function useVoiceLoop({ recorder, converse, pinSheetOpen }: UseVoiceLoopArgs): UseVoiceLoopResult {
  const [state, dispatch] = useReducer(voiceLoopReducer, initialVoiceLoopState);

  // Latest-value refs: the handlers below are stable (the screen holds them in a
  // ref across renders) but must always see the current mode / hook instances.
  const modeRef = useRef(state.mode);
  modeRef.current = state.mode;
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const converseRef = useRef(converse);
  converseRef.current = converse;

  /** Stops the mic and marks any clip still in flight as unwanted, so the
   *  onFinished that lands a moment later is dropped rather than sent. */
  const abortRecording = useCallback(() => {
    Promise.resolve(recorderRef.current.stop()).catch(() => {});
  }, []);

  const stop = useCallback((reason: 'user' | 'typed' | 'left' = 'user') => {
    if (modeRef.current === 'off') return;
    modeRef.current = 'off';
    dispatch({ type: 'stop', reason });
    // Release both audio sessions: a clip may be recording and a reply playing.
    // recorder.stop() resolves asynchronously and its onFinished fires *after*
    // this — onRecordingFinished below drops it because the mode is no longer
    // 'listening'.
    abortRecording();
    converseRef.current.interrupt();
  }, [abortRecording]);

  const start = useCallback(() => dispatch({ type: 'start' }), []);

  const interrupt = useCallback(() => {
    converseRef.current.interrupt();
    dispatch({ type: 'interrupt' });
  }, []);

  const onTextSend = useCallback((text: string) => {
    // Typing is a modality change: the conversation ends, then the text is sent
    // as a plain tap-per-turn message.
    if (modeRef.current !== 'off') stop('typed');
    converseRef.current.sendText(text);
  }, [stop]);

  const sendSuggestion = useCallback((intent: string) => {
    converseRef.current.sendText(intent);
    dispatch({ type: 'sent' });
  }, []);

  // Stable handler object — the host screen stores it in a ref and forwards the
  // recorder / converse callbacks to it.
  const handlers = useRef<VoiceLoopHandlers>({
    onRecordingFinished: (result: RecordingResult) => {
      // The clip lands one tick after recorder.stop() resolves, by which time
      // the loop may have been paused (PIN sheet) or ended (X tap, blur,
      // background). Anything recorded for a window we are no longer in is
      // discarded — in particular this is what keeps PIN-time audio away from
      // /converse (spec §1 rule 5).
      if (modeRef.current !== 'listening') return;
      if (result.hadSpeech) {
        converseRef.current.sendAudio(result.uri);
        dispatch({ type: 'sent' });
      } else {
        // Never spend a Gemini call on a clip with nothing in it.
        dispatch({ type: 'noSpeech' });
      }
    },
    onSpeechEnd: () => dispatch({ type: 'audioEnded' }),
    onTurnDone: () => dispatch({ type: 'turnDone' }),
    onError: () => dispatch({ type: 'error' }),
  }).current;

  // Re-arm the mic. Runs on every entry into `listening` and on every silent
  // turn (the mode does not change then, hence silentTurns in the deps).
  useEffect(() => {
    if (state.mode !== 'listening') return;
    let started = false;
    const timer = setTimeout(() => {
      // The mode can change during the delay (PIN sheet, X tap, blur) — check
      // the latest value, not the one captured when the timer was scheduled.
      if (modeRef.current !== 'listening') return;
      // iOS audio session: the player must go before the recorder session opens.
      // setAudioModeAsync({ allowsRecording: true }) happens inside start().
      converseRef.current.interrupt();
      started = true;
      Promise.resolve(recorderRef.current.start()).catch(() => {});
    }, REARM_DELAY_MS);
    return () => {
      clearTimeout(timer);
      // Leaving 'listening' after the mic was opened from *this* effect (pause,
      // stop, blur, a turn being sent) must close it again — clearing the timer
      // alone would leave a hot mic behind.
      if (started) abortRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode, state.silentTurns, abortRecording]);

  // Playback started for this turn.
  useEffect(() => {
    if (converse.status === 'speaking') dispatch({ type: 'audioStarted' });
  }, [converse.status]);

  // PIN sheet open/close → pause/resume (the reducer no-ops when not applicable).
  // Opening it must also close the mic immediately: the spoken PIN must never
  // be recorded, let alone reach /converse. modeRef flips first so the clip
  // that stop() flushes is dropped by onRecordingFinished.
  useEffect(() => {
    if (pinSheetOpen) {
      if (modeRef.current === 'off') return;
      modeRef.current = 'paused';
      dispatch({ type: 'pause' });
      abortRecording();
      converseRef.current.interrupt();
      return;
    }
    dispatch({ type: 'resume' });
  }, [pinSheetOpen, abortRecording]);

  // Backgrounding the app ends the conversation — no hot mic behind the app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // Only a real background transition ends the conversation. iOS also emits
      // 'inactive' for the mic-permission dialog, Control Center and the
      // app-switcher gesture — ending on those would kill the loop on the very
      // first start().
      if (next === 'background') stop('left');
    });
    return () => sub.remove();
  }, [stop]);

  // Leaving the Home tab ends it too (cleanup runs on blur).
  useFocusEffect(
    useCallback(() => {
      return () => stop('left');
    }, [stop]),
  );

  return {
    mode: state.mode,
    endedReason: state.endedReason,
    start,
    stop,
    interrupt,
    onTextSend,
    sendSuggestion,
    handlers,
  };
}

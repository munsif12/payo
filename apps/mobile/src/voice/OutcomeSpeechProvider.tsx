import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import i18n from '../i18n';
import type { RootState } from '../store';
import type { PinSheetResolution } from '../pin/usePinSheet';
import { requestSpeech } from './speak';
import { outcomeSpeech, type OutcomeAction } from './outcomeSpeech';

type Player = (url: string) => void;

export interface OutcomeSpeechValue {
  /** Compose the outcome sentence, get TTS for it, play it. Fire-and-forget:
   *  the caller has already shown the success card and must not wait on audio,
   *  and a failure anywhere here is silence, never an error on screen. */
  speak: (resolution: PinSheetResolution, action: OutcomeAction) => void;
  /** Home publishes `useConverse.playAudio` here (see useRegisterOutcomePlayer).
   *  Going through THAT player rather than a private one is the whole point:
   *  it is what makes the hands-free loop see `speaking` → `audioStarted` and
   *  then `onSpeechEnd` → `audioEnded`, so the mic re-arms after the sentence
   *  instead of the loop sitting dead. Exactly the digest's arrangement. */
  setPlayer: (play: Player | null) => void;
}

const OutcomeSpeechContext = createContext<OutcomeSpeechValue | null>(null);

/** Null-object fallback so a screen rendered outside the provider (a test
 *  harness, a future standalone route) simply stays silent. */
const SILENT: OutcomeSpeechValue = { speak: () => {}, setPlayer: () => {} };

export function useOutcomeSpeech(): OutcomeSpeechValue {
  return useContext(OutcomeSpeechContext) ?? SILENT;
}

/** Publishes a player for the lifetime of the calling screen. */
export function useRegisterOutcomePlayer(play: Player): void {
  const { setPlayer } = useOutcomeSpeech();
  const playRef = useRef(play);
  playRef.current = play;
  React.useEffect(() => {
    setPlayer((url) => playRef.current(url));
    return () => setPlayer(null);
  }, [setPlayer]);
}

export function OutcomeSpeechProvider({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  const playerRef = useRef<Player | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const setPlayer = useCallback((play: Player | null) => { playerRef.current = play; }, []);

  const speak = useCallback((resolution: PinSheetResolution, action: OutcomeAction) => {
    const text = outcomeSpeech(resolution, action, i18n.language);
    if (!text) return;
    (async () => {
      try {
        const url = await requestSpeech(text, i18n.language, tokenRef.current);
        // Resolved after an await — the screen that owned the player may have
        // unmounted (the classic flow pops back to the tabs). Read it now.
        if (url) playerRef.current?.(url);
      } catch {
        // TTS is a nicety on top of a payment that already succeeded.
      }
    })();
  }, []);

  const value = useMemo(() => ({ speak, setPlayer }), [speak, setPlayer]);
  return <OutcomeSpeechContext.Provider value={value}>{children}</OutcomeSpeechContext.Provider>;
}

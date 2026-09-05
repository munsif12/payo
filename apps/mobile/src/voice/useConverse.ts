import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useDispatch, useSelector } from 'react-redux';
import { signedOut } from '../store/authSlice';
import { aiUrl } from '../lib/aiUrl';
import { postSse } from '../lib/sse';
import type { RootState } from '../store';
import i18n from '../i18n';
import { createInFlightGate } from './inFlightGate';
import { speakSafetyMs } from './speakSafety';

export interface ChatCard { kind: string; [k: string]: unknown }
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  cards: ChatCard[];
  /** True for a message rehydrated from persisted history rather than produced
   *  by this session's live SSE stream. A restored `confirmation` must never
   *  auto-open the PIN sheet (see CardView's autoOpenPin guard). Nothing in
   *  useConverse sets it — every message here is live — but the flag is part of
   *  the message contract so a future history loader cannot forget it. */
  restored?: boolean;
}

export type ConverseStatus = 'idle' | 'thinking' | 'speaking';

export interface ConverseOptions {
  /** Playback of this turn's audio finished (didJustFinish) or the safety cap fired. Once per turn. */
  onSpeechEnd?: () => void;
  /** SSE `done` arrived and no `audio` event was seen in this turn (text-only reply). */
  onTurnDone?: () => void;
  /** A server-sent `error` event, or a transport error on the stream. */
  onError?: () => void;
}

let nextId = 0;
const mid = () => `local-${Date.now().toString(36)}-${++nextId}`;

export function useConverse(opts?: ConverseOptions) {
  const token = useSelector((s: RootState) => s.auth.token);
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConverseStatus>('idle');
  const sessionId = useRef<string | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightGate = useRef(createInFlightGate()).current;
  // Kept in a ref so the SSE/player callbacks below always see the latest
  // handlers without having to be re-created on every render.
  const optsRef = useRef<ConverseOptions | undefined>(opts);
  optsRef.current = opts;
  /** Did this turn ever produce an `audio` event? Decides onTurnDone vs onSpeechEnd. */
  const audioThisTurn = useRef(false);
  /** onSpeechEnd fires at most once per turn (didJustFinish *and* the cap can race). */
  const speechEndFired = useRef(false);

  const fireSpeechEnd = () => {
    if (speechEndFired.current) return;
    speechEndFired.current = true;
    optsRef.current?.onSpeechEnd?.();
  };

  useEffect(() => {
    return () => {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      soundRef.current?.remove();
    };
  }, []);

  const append = (m: ChatMessage) => setMessages(prev => [...prev, m]);
  const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages(prev => prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1])] : prev);

  const clearSpeakTimeout = () => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
  };

  const endSpeaking = () => {
    setStatus(cur => (cur === 'speaking' ? 'idle' : cur));
    fireSpeechEnd();
  };

  /** (Re)arms the safety cap from the audio still left to play.
   *  v3 used a flat 4 s, which truncated any reply longer than that. The cap is
   *  now derived from the player (speakSafetyMs) and re-armed on *every* status
   *  update, so a buffering stall or an output-route change pushes it back
   *  instead of firing over live audio and opening the mic into the speaker.
   *  @param remainingMs audio left to play in ms, or null while unknown. */
  const armSpeakTimeout = (remainingMs?: number | null) => {
    clearSpeakTimeout();
    const ms = speakSafetyMs(remainingMs);
    speakTimeoutRef.current = setTimeout(() => {
      speakTimeoutRef.current = null;
      endSpeaking();
    }, ms);
  };

  const playAudio = async (url: string) => {
    try {
      soundRef.current?.remove();
      clearSpeakTimeout();
      audioThisTurn.current = true;
      speechEndFired.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: `${aiUrl()}${url}` });
      soundRef.current = player;
      setStatus('speaking');
      let finished = false;
      player.addListener('playbackStatusUpdate', (s) => {
        // expo-audio can keep emitting after the end of the track; once this
        // turn is done, no later update may re-arm the cap.
        if (finished) return;
        if (s.didJustFinish) {
          finished = true;
          clearSpeakTimeout();
          endSpeaking();
          return;
        }
        if (!s.playing) {
          // Buffering / interrupted / not started yet: nothing is being
          // consumed, so the remaining-time cap would be meaningless. Fall back
          // to the unknown ceiling, which also stops a permanent stall from
          // leaving the UI stuck in "speaking".
          armSpeakTimeout(null);
          return;
        }
        const remainingMs = s.duration > 0 ? (s.duration - s.currentTime) * 1000 : null;
        armSpeakTimeout(remainingMs);
      });
      player.play();
      // Until the first status update arrives, hold the generous unknown
      // ceiling so the UI can never be stuck in "speaking". Kept in a ref so a
      // new turn (or unmount, or interrupt) can cancel it.
      armSpeakTimeout(null);
    } catch {
      setStatus('idle');
    }
  };

  /** Stops and removes the player immediately (tap-to-interrupt). Deliberately
   *  does NOT fire onSpeechEnd — the loop hook dispatches `interrupt` itself. */
  const interrupt = () => {
    clearSpeakTimeout();
    speechEndFired.current = true;
    try {
      soundRef.current?.remove();
    } catch {
      // player already torn down — nothing to release.
    }
    soundRef.current = null;
    setStatus('idle');
  };

  const run = (opts: { text?: string; audioUri?: string; userBubble: string | null }) => {
    // Synchronous gate — see createInFlightGate. Must run before any
    // setState, since status/React state only updates on the next render.
    if (!inFlightGate.tryEnter()) return;
    soundRef.current?.remove();
    soundRef.current = null;
    clearSpeakTimeout();
    audioThisTurn.current = false;
    speechEndFired.current = false;
    setStatus('thinking');
    if (opts.userBubble != null) append({ id: mid(), role: 'user', text: opts.userBubble, cards: [] });
    const assistantId = mid();
    let assistantStarted = false;
    const ensureAssistant = () => {
      if (!assistantStarted) {
        assistantStarted = true;
        append({ id: assistantId, role: 'assistant', text: '', cards: [] });
      }
    };

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let body: string | undefined;
    let formData: FormData | undefined;
    if (opts.audioUri) {
      formData = new FormData();
      // @ts-expect-error RN FormData file object
      formData.append('audio', { uri: opts.audioUri, name: 'clip.m4a', type: 'audio/m4a' });
      formData.append('language', i18n.language);
      if (sessionId.current) formData.append('sessionId', sessionId.current);
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ text: opts.text, language: i18n.language, sessionId: sessionId.current ?? undefined });
    }

    postSse(`${aiUrl()}/converse`, {
      headers, body, formData,
      onEvent: (e) => {
        const d = e.data as Record<string, unknown>;
        switch (e.event) {
          case 'transcript':
            if (opts.userBubble == null) append({ id: mid(), role: 'user', text: String(d.text ?? ''), cards: [] });
            break;
          case 'token':
            ensureAssistant();
            patchLast(m => m.id === assistantId ? { ...m, text: m.text + String(d.text ?? '') } : m);
            break;
          case 'card':
            ensureAssistant();
            patchLast(m => m.id === assistantId ? { ...m, cards: [...m.cards, d.card as ChatCard] } : m);
            break;
          case 'audio':
            playAudio(String(d.url));
            break;
          case 'done':
            sessionId.current = String(d.sessionId);
            setStatus(s => (s === 'thinking' ? 'idle' : s));
            if (!audioThisTurn.current) optsRef.current?.onTurnDone?.();
            break;
          case 'error':
            append({ id: mid(), role: 'error', text: String(d.message ?? 'Error'), cards: [] });
            setStatus('idle');
            // Release here too: if the stream never closes after a server-sent
            // error, waiting for onDone/onError alone would leave the gate
            // stuck occupied and the UI unable to send again. release() is
            // idempotent, so a later onDone/onError for this same request is
            // a harmless no-op.
            inFlightGate.release();
            // The AI service forwards backend auth failures verbatim: the stored session is dead.
            optsRef.current?.onError?.();
            if (d.code === 'UNAUTHORIZED' || d.code === 'SESSION_EXPIRED') dispatch(signedOut());
            break;
        }
      },
      onDone: () => {
        setStatus(s => (s === 'thinking' ? 'idle' : s));
        inFlightGate.release();
      },
      onError: () => {
        append({ id: mid(), role: 'error', text: i18n.t('voice.networkError'), cards: [] });
        setStatus('idle');
        optsRef.current?.onError?.();
        inFlightGate.release();
      },
    });
  };

  const sendText = (text: string) => run({ text, userBubble: text });
  const sendAudio = (audioUri: string) => run({ audioUri, userBubble: null });

  // Appends a fully-formed assistant message that never went through the
  // /converse stream (e.g. a success + save_prompt card pair rendered
  // locally right after a PinSheet execute). Not gated by inFlightGate —
  // it isn't a request/response turn.
  const appendLocal = (message: Omit<ChatMessage, 'id'> & { id?: string }) =>
    append({ id: message.id ?? mid(), role: message.role, text: message.text, cards: message.cards, restored: message.restored });

  // playAudio is exported so Home can speak its proactive digest (POST /speak →
  // this player) through the SAME path a conversational reply uses — one player,
  // one safety cap, one "speaking" status, so a digest and a turn can never
  // overlap. It fires onSpeechEnd like any other clip; the voice loop ignores
  // that while it is off (voiceLoopReducer's `audioEnded` is mode-gated).
  return { messages, status, sendText, sendAudio, appendLocal, interrupt, playAudio };
}

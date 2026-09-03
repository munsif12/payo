import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useDispatch, useSelector } from 'react-redux';
import { signedOut } from '../store/authSlice';
import { aiUrl } from '../lib/aiUrl';
import { postSse } from '../lib/sse';
import type { RootState } from '../store';
import i18n from '../i18n';
import { createInFlightGate } from './inFlightGate';

export interface ChatCard { kind: string; [k: string]: unknown }
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  cards: ChatCard[];
}

export type ConverseStatus = 'idle' | 'thinking' | 'speaking';

let nextId = 0;
const mid = () => `local-${Date.now().toString(36)}-${++nextId}`;

export function useConverse() {
  const token = useSelector((s: RootState) => s.auth.token);
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConverseStatus>('idle');
  const sessionId = useRef<string | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightGate = useRef(createInFlightGate()).current;

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

  const playAudio = async (url: string) => {
    try {
      soundRef.current?.remove();
      clearSpeakTimeout();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: `${aiUrl()}${url}` });
      soundRef.current = player;
      setStatus('speaking');
      player.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) setStatus(cur => (cur === 'speaking' ? 'idle' : cur));
      });
      player.play();
      // Safety: never leave the UI stuck in "speaking" (stub audio is ~0.1s).
      // Kept in a ref so a new turn (or unmount) can cancel it — otherwise a
      // stale timer could flip a later turn's "speaking" back to "idle".
      speakTimeoutRef.current = setTimeout(() => {
        setStatus(cur => (cur === 'speaking' ? 'idle' : cur));
        speakTimeoutRef.current = null;
      }, 4000);
    } catch {
      setStatus('idle');
    }
  };

  const run = (opts: { text?: string; audioUri?: string; userBubble: string | null }) => {
    // Synchronous gate — see createInFlightGate. Must run before any
    // setState, since status/React state only updates on the next render.
    if (!inFlightGate.tryEnter()) return;
    soundRef.current?.remove();
    soundRef.current = null;
    clearSpeakTimeout();
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
        inFlightGate.release();
      },
    });
  };

  const sendText = (text: string) => run({ text, userBubble: text });
  const sendAudio = (audioUri: string) => run({ audioUri, userBubble: null });

  return { messages, status, sendText, sendAudio };
}

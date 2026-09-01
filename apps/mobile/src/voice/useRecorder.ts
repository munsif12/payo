import { useEffect, useRef } from 'react';
import {
  AudioModule, RecordingPresets, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';

const SILENCE_DB = -35;
const SILENCE_MS = 1500;
const MAX_MS = 15000;
const WARMUP_MS = 2000;

export interface RecordingResult { uri: string; mime: string }

/** Mic recording with metering-based silence auto-stop (expo-audio, SDK 57). */
export function useRecorder(onFinished: (r: RecordingResult) => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 300);
  const silenceSince = useRef<number | null>(null);
  const startedAt = useRef(0);
  const stopping = useRef(false);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const stop = async () => {
    if (stopping.current || !recorder.isRecording) return;
    stopping.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) finishedRef.current({ uri: recorder.uri, mime: 'audio/m4a' });
    } finally {
      stopping.current = false;
    }
  };

  const start = async () => {
    try {
      console.log('[recorder] start; isRecording=', recorder.isRecording);
      if (recorder.isRecording) { await stop(); return; }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      console.log('[recorder] permission', perm.granted);
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      silenceSince.current = null;
      startedAt.current = Date.now();
      await recorder.prepareToRecordAsync();
      recorder.record();
      console.log('[recorder] recording started');
    } catch (e) {
      console.log('[recorder] start failed', String(e));
    }
  };

  // Silence auto-stop: watch the metered level while recording.
  useEffect(() => {
    if (!state.isRecording || stopping.current) return;
    const now = Date.now();
    if (now - startedAt.current > MAX_MS) { stop(); return; }
    if (now - startedAt.current < WARMUP_MS) return;
    const level = state.metering ?? 0;
    if (level < SILENCE_DB) {
      if (silenceSince.current == null) silenceSince.current = now;
      else if (now - silenceSince.current > SILENCE_MS) stop();
    } else {
      silenceSince.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.metering, state.durationMillis]);

  return { recording: state.isRecording, start, stop };
}

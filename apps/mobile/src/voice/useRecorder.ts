import { useEffect, useRef } from 'react';
import {
  AudioModule, RecordingPresets, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { silenceDecision } from './silence';

export interface RecordingResult {
  uri: string;
  mime: string;
  /** True when peak metering crossed SPEECH_THRESHOLD_DB at any point in the clip. */
  hadSpeech: boolean;
}

/** Mic recording with metering-based auto-stop (expo-audio, SDK 57).
 *  The pre-speech / post-speech timing rule lives in the pure `silenceDecision`
 *  helper (src/voice/silence.ts); this hook only applies its verdict. */
export function useRecorder(onFinished: (r: RecordingResult) => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 300);
  const silenceSince = useRef<number | null>(null);
  const hadSpeech = useRef(false);
  const startedAt = useRef(0);
  const stopping = useRef(false);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const stop = async () => {
    if (stopping.current || !recorder.isRecording) return;
    stopping.current = true;
    const speech = hadSpeech.current;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) finishedRef.current({ uri: recorder.uri, mime: 'audio/m4a', hadSpeech: speech });
    } finally {
      stopping.current = false;
    }
  };

  const start = async () => {
    try {
      if (recorder.isRecording) { await stop(); return; }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      silenceSince.current = null;
      hadSpeech.current = false;
      startedAt.current = Date.now();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      // mic start failed (permission race, device busy) — surfaced to the user
      // via the unchanged recording state; nothing to recover here.
    }
  };

  // Auto-stop: watch the metered level while recording and apply silenceDecision.
  useEffect(() => {
    if (!state.isRecording || stopping.current) return;
    const result = silenceDecision({
      now: Date.now(),
      startedAt: startedAt.current,
      level: state.metering ?? -160,
      hadSpeech: hadSpeech.current,
      silenceSince: silenceSince.current,
    });
    hadSpeech.current = result.hadSpeech;
    silenceSince.current = result.silenceSince;
    if (result.decision === 'stop') stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.metering, state.durationMillis]);

  // Unmount cleanup: a screen using this hook can go away mid-recording (nav away,
  // tab switch) — stop/unload the native recorder and release the mic session so it
  // doesn't keep running in the background. Deliberately bypasses `stop()`'s
  // onFinished callback: the screen is gone, there's nowhere to deliver the result.
  useEffect(() => {
    return () => {
      // The native shared object backing `recorder` may already be torn down by the
      // time this runs (e.g. React 18 Strict Mode's dev-only mount/unmount/remount, or
      // a fast reload) — reading `isRecording` or calling `stop()` on it can throw in
      // that case, and there is nothing left to clean up, so swallow it.
      try {
        if (recorder.isRecording) {
          recorder.stop().catch(() => {});
          setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        }
      } catch {
        // native object already gone — nothing to release.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { recording: state.isRecording, start, stop };
}

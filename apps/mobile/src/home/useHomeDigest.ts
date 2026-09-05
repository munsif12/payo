import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useMeQuery, useDigestMutation } from '../api/client';
import { requestSpeech } from '../voice/speak';
import type { ChatCard } from '../voice/useConverse';
import type { RootState } from '../store';
import { LAST_DIGEST_STORAGE_KEY, shouldFetchDigest, digestSpeech, toDigestCard } from './digestLogic';
import i18n from '../i18n';

/** Best-effort read of the on-device "last digest" stamp. A missing or unreadable
 *  value means "never spoken", which `shouldFetchDigest` treats as due. */
async function readStamp(): Promise<number | null> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(LAST_DIGEST_STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function writeStamp(value: number): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(LAST_DIGEST_STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable — the digest just isn't rate-limited on this launch.
  }
}

/**
 * The proactive greeting (spec §1 C, §4). On every Home focus: if the user has
 * "PAYO speaks first" on and this device has not spoken a digest for 4 h, fetch
 * `GET /me/digest?ack=1`, render the rows under the greeting, and speak a ≤ 2-sentence
 * summary built entirely on-device (`digestSpeech`) through `POST /speak`.
 *
 * `?ack=1` moves the server-side cursor, so the fetch must happen at most once per
 * focus — `runningRef` guards the overlap, and the local stamp guards the 4 h rule
 * (both are written BEFORE the speech, so a TTS failure cannot cause a re-ack loop).
 *
 * Everything here is best-effort: nothing about the digest may block or break Home.
 */
export function useHomeDigest(speak: (url: string) => void): ChatCard | null {
  const { data: me } = useMeQuery();
  const token = useSelector((s: RootState) => s.auth.token);
  const [fetchDigest] = useDigestMutation();
  const [card, setCard] = useState<ChatCard | null>(null);
  const runningRef = useRef(false);
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // Absent on an older backend — the server default is ON.
  const enabled = me?.user.preferences?.proactiveGreeting ?? true;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // With the setting off nothing financial may appear unprompted — including
      // a digest card left over from before the user turned it off.
      if (!enabled) {
        setCard(null);
        return () => { cancelled = true; };
      }
      if (!me || runningRef.current) return () => { cancelled = true; };
      runningRef.current = true;
      (async () => {
        try {
          if (!shouldFetchDigest(await readStamp(), Date.now(), enabled)) return;
          const res = await fetchDigest({ ack: true }).unwrap();
          await writeStamp(Date.now());
          if (cancelled || !res.items.length) return;
          setCard(toDigestCard(res.items) as unknown as ChatCard);
          const url = await requestSpeech(digestSpeech(res.items, i18n.language), i18n.language, token);
          if (!cancelled && url) speakRef.current(url);
        } catch {
          // Network, auth, TTS — the greeting simply stays plain.
        } finally {
          runningRef.current = false;
        }
      })();
      return () => { cancelled = true; };
    }, [me, enabled, fetchDigest, token]),
  );

  return card;
}

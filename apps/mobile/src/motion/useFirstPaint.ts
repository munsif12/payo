import { useEffect, useState } from 'react';

/**
 * True only for the FIRST paint of this component instance (spec §3: "Choreography
 * runs once per screen mount (a `firstPaint` ref); tab switches, re-renders and
 * list updates never re-run it").
 *
 * It flips to false in the mount effect, i.e. immediately after the first commit,
 * so:
 *  - children mounted in that first commit read `true` and play their entrance;
 *  - every later re-render — a new message, a digest arriving, a state change,
 *    and crucially a tab re-focus (expo-router keeps the screen mounted) — reads
 *    `false`, so nothing replays.
 *
 * Consumers that start an animation from this flag must latch it (WordRise arms
 * on it, Sheet and useRise latch at mount) so the flip does not cancel an
 * entrance already running.
 *
 * `ready` holds the flag back until the content is worth animating — Home passes
 * `name.length > 0` for the greeting, because the name arrives from /me a beat
 * after mount and a nameless greeting is not the line we want to play in.
 */
export function useFirstPaint(ready = true): boolean {
  const [spent, setSpent] = useState(false);
  const firstPaint = ready && !spent;
  useEffect(() => {
    if (firstPaint) setSpent(true);
  }, [firstPaint]);
  return firstPaint;
}

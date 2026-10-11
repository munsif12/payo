/**
 * orbBus — the voice orb's tiny module store (GLASS-SPEC §3).
 *
 * The orb appears in three places (the hero on Home, the mini orb in a head
 * row, the nav orb in the tab pill) but only Home owns the hands-free loop.
 * This bus lets any orb press reach that loop without prop drilling:
 *
 *   state: 'idle' | 'live' | 'listening'
 *     Home mirrors its loop here (`setState`) so every orb can show `Mic` at
 *     rest and `AudioLines` while listening. Read it in React with
 *     `useOrbState()` (useSyncExternalStore — re-renders on change).
 *
 *   setHandler(fn | null)
 *     Home registers its toggle (`live ? stop : start`) on mount/focus and
 *     clears it with null on unmount/blur.
 *
 *   press(): boolean
 *     An orb was tapped. With a handler registered it is called and `true`
 *     comes back — the caller is done. Without one `pendingStart` is latched
 *     and `false` comes back: the caller navigates to Home, and Home calls
 *     `consumePendingStart()` when it mounts/focuses to start the loop.
 *
 *   consumePendingStart(): boolean
 *     Returns the latched flag once and clears it.
 *
 * The tabs layout wires the nav orb as
 *   `if (!orbBus.press() || active !== 'home') navigate('home')`
 * — so a press from Wallet/Pay/More always lands on Home, whether Home kept
 * its handler registered while unfocused (the loop starts straight away) or
 * cleared it on blur (Home consumes the pending start on focus).
 */
import { useSyncExternalStore } from 'react';

export type OrbState = 'idle' | 'live' | 'listening';
export type OrbHandler = () => void;
type Listener = () => void;

let state: OrbState = 'idle';
let handler: OrbHandler | null = null;
let pendingStart = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const orbBus = {
  getState(): OrbState {
    return state;
  },

  setState(next: OrbState): void {
    if (state === next) return;
    state = next;
    emit();
  },

  setHandler(fn: OrbHandler | null): void {
    handler = fn;
  },

  hasHandler(): boolean {
    return handler !== null;
  },

  press(): boolean {
    if (handler) {
      handler();
      return true;
    }
    pendingStart = true;
    return false;
  },

  consumePendingStart(): boolean {
    const was = pendingStart;
    pendingStart = false;
    return was;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Back to a clean slate — tests, and a sign-out. */
  reset(): void {
    handler = null;
    pendingStart = false;
    if (state !== 'idle') {
      state = 'idle';
      emit();
    }
  },
};

/** The orb's state, live. */
export function useOrbState(): OrbState {
  return useSyncExternalStore(orbBus.subscribe, orbBus.getState, orbBus.getState);
}

import { useSyncExternalStore } from 'react';
import type { PendingAction } from '../api/types';

// Confirmation flow hand-off: the creating screen stores the action, the
// confirm screen (routed by id) picks it up. Avoids serializing via route params.
let current: PendingAction | null = null;
export const holdAction = (a: PendingAction) => { current = a; };
export const takeAction = (id: string): PendingAction | null =>
  current && current.id === id ? current : null;

// Completed-action registry: once an action is executed, every chat card that still
// references it must render as done (a second tap would only 410 on the backend).
const done = new Set<string>();
const listeners = new Set<() => void>();
export const markActionDone = (id: string) => {
  done.add(id);
  listeners.forEach((l) => l());
};
export const isActionDone = (id: string) => done.has(id);
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** React hook: true once the given action id has been executed in this app session. */
export const useActionDone = (id: string) =>
  useSyncExternalStore(subscribe, () => done.has(id), () => done.has(id));

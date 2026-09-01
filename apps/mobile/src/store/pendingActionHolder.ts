import type { PendingAction } from '../api/types';

// Confirmation flow hand-off: the creating screen stores the action, the
// confirm screen (routed by id) picks it up. Avoids serializing via route params.
let current: PendingAction | null = null;
export const holdAction = (a: PendingAction) => { current = a; };
export const takeAction = (id: string): PendingAction | null =>
  current && current.id === id ? current : null;

/** A wrong transaction PIN on POST /actions/:id/execute also answers 401 INVALID_PIN
 *  (see services/backend/src/lib/pendingActions.ts) — that is a mistyped PIN on an
 *  otherwise-healthy session, not a dead one, and the screen already handles it itself
 *  (shake + inline error, letting the user retry). Match the trailing "/execute" so a
 *  wrong PIN there doesn't blow away the session and bounce the user back to the phone
 *  screen. */
const isActionExecute = (url: string): boolean => /^\/actions\/[^/]+\/execute$/.test(url);

/** A 401 on any other authenticated (non-/auth) call means the stored session is dead —
 *  expired, or the user no longer exists (e.g. after a reseed). Pure so it is unit-testable
 *  without importing RTK Query. */
export function shouldSignOut(status: unknown, url: string, hasToken: boolean): boolean {
  return status === 401 && hasToken && !url.startsWith('/auth/') && !isActionExecute(url);
}

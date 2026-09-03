/** A wrong transaction PIN on POST /actions/:id/execute also answers 401 INVALID_PIN
 *  (see services/backend/src/lib/pendingActions.ts) — that is a mistyped PIN on an
 *  otherwise-healthy session, not a dead one, and the screen already handles it itself
 *  (shake + inline error, letting the user retry). Same for PIN_LOCKED (too many wrong
 *  PINs) — the screen shows its own lockout message. Both are exempted by error CODE,
 *  not by URL, so any other 401 on /actions/:id/execute (e.g. a stale session hitting
 *  SESSION_EXPIRED) still signs the user out like it would anywhere else. */
const NEVER_SIGN_OUT_CODES = new Set(['INVALID_PIN', 'PIN_LOCKED']);

/** A 401 on any other authenticated (non-/auth) call means the stored session is dead —
 *  expired, or the user no longer exists (e.g. after a reseed) — UNLESS the error code
 *  is one of the PIN-retry codes above. Pure so it is unit-testable without importing
 *  RTK Query. */
export function shouldSignOut(status: unknown, url: string, hasToken: boolean, code?: string): boolean {
  if (status !== 401 || !hasToken || url.startsWith('/auth/')) return false;
  if (code && NEVER_SIGN_OUT_CODES.has(code)) return false;
  return true;
}

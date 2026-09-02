/** A 401 on any authenticated (non-/auth) call means the stored session is dead —
 *  expired, or the user no longer exists (e.g. after a reseed). Pure so it is unit-testable
 *  without importing RTK Query. */
export function shouldSignOut(status: unknown, url: string, hasToken: boolean): boolean {
  return status === 401 && hasToken && !url.startsWith('/auth/');
}

import bcrypt from 'bcryptjs';
import { User } from '../models';
import { ApiError } from './apiError';

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Verifies `pin` against the user's PIN hash with brute-force lockout, shared by
 * auth/verify-pin (both token scopes) and the PIN-required action-execute path.
 * 5 wrong attempts locks further attempts for 15 minutes (429 PIN_LOCKED); a
 * correct PIN resets the counter and any active lock. Guards a missing pinHash
 * (never set yet) so that path fails as 401 INVALID_PIN, not a 500.
 */
export async function assertPinOk(user: InstanceType<typeof User>, pin: string | undefined) {
  const now = new Date();
  if (user.pinLockedUntil && user.pinLockedUntil > now)
    throw new ApiError(429, 'PIN_LOCKED', 'Too many attempts, try again later');

  const matches = !!pin && !!user.pinHash && (await bcrypt.compare(pin, user.pinHash));
  if (!matches) {
    user.pinAttempts = (user.pinAttempts ?? 0) + 1;
    if (user.pinAttempts >= MAX_PIN_ATTEMPTS) {
      user.pinLockedUntil = new Date(now.getTime() + LOCK_MS);
      user.pinAttempts = 0;
    }
    await user.save();
    throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  }

  if (user.pinAttempts || user.pinLockedUntil) {
    user.pinAttempts = 0;
    user.pinLockedUntil = undefined;
    await user.save();
  }
}

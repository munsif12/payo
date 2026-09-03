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
    // Atomic $inc so two concurrent wrong attempts each land their own +1 instead of a
    // read-modify-write race clobbering one another (both reading pinAttempts=0, both
    // writing 1). Lock-set is a second atomic write, guarded by the just-incremented
    // count so only the attempt that actually crosses the threshold locks the account.
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { pinAttempts: 1 } },
      { new: true },
    );
    if (updated && updated.pinAttempts >= MAX_PIN_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id, pinAttempts: { $gte: MAX_PIN_ATTEMPTS } },
        { $set: { pinLockedUntil: new Date(now.getTime() + LOCK_MS), pinAttempts: 0 } },
      );
    }
    throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  }

  // Re-read before the reset write: `user` may be a stale in-memory doc (e.g. loaded
  // before a just-failed sibling attempt incremented pinAttempts in the DB), and we
  // must not save() a stale pinAttempts/pinLockedUntil back over a fresher value.
  const fresh = (await User.findById(user._id)) ?? user;
  if (fresh.pinAttempts || fresh.pinLockedUntil) {
    fresh.pinAttempts = 0;
    fresh.pinLockedUntil = null;
    await fresh.save();
  }
}

import jwt from 'jsonwebtoken';
import { config } from '../config';

/** Full session token — 30 days, accepted by every `requireAuth`-gated route. */
export const signSession = (u: { _id: unknown; email?: string | null }) =>
  jwt.sign({ sub: String(u._id), email: u.email ?? undefined, scope: 'session' }, config.jwtSecret, { expiresIn: '30d' });

/** Short-lived token proving OTP verification only — 10 min, accepted only by set-pin/verify-pin. */
export const signOtpToken = (u: { _id: unknown }) =>
  jwt.sign({ sub: String(u._id), scope: 'otp' }, config.jwtSecret, { expiresIn: '10m' });

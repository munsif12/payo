import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError';
import { config } from '../config';
import { User } from '../models';

type TokenPayload = { sub: string; scope?: 'otp' | 'session' };

/**
 * Verifies the bearer JWT AND that its subject still exists. A signed token for a
 * deleted user (e.g. after a reseed) must be rejected, otherwise every ownership-
 * scoped query silently returns empty and the client behaves like a ghost account.
 */
async function verifyAndLoadUser(req: Request): Promise<TokenPayload> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  }
  if (!(await User.exists({ _id: payload.sub }))) throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in again');
  return payload;
}

/** Standard guard for session-scoped routes. Rejects otp-scope tokens outright. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const { sub, scope } = await verifyAndLoadUser(req);
    if (scope === 'otp') throw new ApiError(401, 'OTP_SCOPE', 'OTP token cannot be used here');
    req.userId = String(sub);
    req.tokenScope = 'session';
    next();
  } catch (e) {
    next(e);
  }
}

/** Guard for set-pin/verify-pin — accepts either an otp-scope or a session-scope token. */
export async function requireOtpOrSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const { sub, scope } = await verifyAndLoadUser(req);
    req.userId = String(sub);
    req.tokenScope = scope === 'otp' ? 'otp' : 'session';
    next();
  } catch (e) {
    next(e);
  }
}

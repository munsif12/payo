import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError';
import { config } from '../config';
import { User } from '../models';

/**
 * Verifies the bearer JWT AND that its subject still exists. A signed token for a
 * deleted user (e.g. after a reseed) must be rejected, otherwise every ownership-
 * scoped query silently returns empty and the client behaves like a ghost account.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');
    let sub: string;
    try {
      sub = String((jwt.verify(token, config.jwtSecret) as { sub: string }).sub);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
    }
    if (!(await User.exists({ _id: sub }))) throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in again');
    req.userId = sub;
    next();
  } catch (e) {
    next(e);
  }
}

import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError';
import { config } from '../config';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');
  try {
    req.userId = String((jwt.verify(token, config.jwtSecret) as { sub: string }).sub);
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  }
  next();
}

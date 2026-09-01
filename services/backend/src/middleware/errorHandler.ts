import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/apiError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError)
    return res.status(err.status).json({ success: false, code: err.code, message: err.message });
  if (err instanceof ZodError)
    return res.status(400).json({ success: false, code: 'VALIDATION', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  console.error(err);
  return res.status(500).json({ success: false, code: 'INTERNAL', message: 'Something went wrong' });
}

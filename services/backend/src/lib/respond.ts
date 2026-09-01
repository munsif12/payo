import { Response } from 'express';
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

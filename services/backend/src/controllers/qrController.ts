import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { config } from '../config';

const sig = (base: string) =>
  crypto.createHmac('sha256', config.jwtSecret).update(base).digest('hex').slice(0, 16);

export async function myQr(req: Request, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  const base = `payo:v1:${user._id}:${user.phone}`;
  return ok(res, { payload: `${base}:${sig(base)}` });
}

export async function resolveQr(req: Request, res: Response) {
  const { payload } = z.object({ payload: z.string() }).parse(req.body);
  const parts = payload.split(':');
  if (parts.length !== 5 || parts[0] !== 'payo' || parts[1] !== 'v1')
    throw new ApiError(400, 'INVALID_QR', 'Not a PAYO QR code');
  const [, , userId, phone, gotSig] = parts;
  const base = `payo:v1:${userId}:${phone}`;
  const expected = sig(base);
  if (gotSig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(gotSig), Buffer.from(expected)))
    throw new ApiError(400, 'INVALID_QR', 'Not a PAYO QR code');
  const user = await User.findById(userId).catch(() => null);
  if (!user) throw new ApiError(400, 'INVALID_QR', 'Not a PAYO QR code');
  return ok(res, {
    user: { name: user.name, urduName: user.urduName ?? undefined, phone: user.phone, avatar: user.avatar ?? undefined },
  });
}

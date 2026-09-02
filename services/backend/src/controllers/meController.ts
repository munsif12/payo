import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { publicUser } from './authController';

/** PATCH /me — profile edits: display name, Urdu name, UI language. */
export async function updateMe(req: Request, res: Response) {
  const body = z.object({
    name: z.string().min(1).optional(),
    urduName: z.string().optional(),
    language: z.enum(['ur', 'en']).optional(),
  }).parse(req.body);

  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');

  if (body.name !== undefined) user.name = body.name;
  if (body.urduName !== undefined) user.urduName = body.urduName;
  if (body.language !== undefined) user.language = body.language;
  await user.save();

  return ok(res, publicUser(user));
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { publicUser } from './authController';

/** PATCH /me — profile edits: display name, Urdu name, UI language, proactive greeting. */
export async function updateMe(req: Request, res: Response) {
  const body = z.object({
    name: z.string().min(1).optional(),
    urduName: z.string().optional(),
    language: z.enum(['ur', 'en']).optional(),
    preferences: z.object({ proactiveGreeting: z.boolean().optional() }).optional(),
  }).parse(req.body);

  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');

  if (body.name !== undefined) user.name = body.name;
  if (body.urduName !== undefined) user.urduName = body.urduName;
  if (body.language !== undefined) user.language = body.language;
  if (body.preferences?.proactiveGreeting !== undefined)
    user.preferences.proactiveGreeting = body.preferences.proactiveGreeting;
  await user.save();

  return ok(res, publicUser(user));
}

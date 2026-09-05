import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { publicUser } from './authController';
import { isAdult } from '../lib/risk';

/** PATCH /me — profile edits: display name, Urdu name, UI language, proactive greeting. */
export async function updateMe(req: Request, res: Response) {
  const body = z.object({
    name: z.string().min(1).optional(),
    urduName: z.string().optional(),
    language: z.enum(['ur', 'en']).optional(),
    // An ISO calendar date (`YYYY-MM-DD`), parsed as UTC midnight so the stored day cannot
    // drift by a timezone. Under 18 is refused: PAYO has no minor accounts, and a bogus
    // recent date would also silently switch off the senior check-in.
    dateOfBirth: z.string()
      .refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date of birth must be YYYY-MM-DD')
      .transform(v => new Date(`${v}T00:00:00.000Z`))
      .refine(d => !isNaN(d.getTime()), 'Date of birth is not a real date')
      .refine(d => isAdult(d), 'You must be at least 18')
      .optional(),
    preferences: z.object({ proactiveGreeting: z.boolean().optional() }).optional(),
  }).parse(req.body);

  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');

  if (body.name !== undefined) user.name = body.name;
  if (body.urduName !== undefined) user.urduName = body.urduName;
  if (body.language !== undefined) user.language = body.language;
  if (body.dateOfBirth !== undefined) user.dateOfBirth = body.dateOfBirth;
  if (body.preferences?.proactiveGreeting !== undefined)
    user.preferences.proactiveGreeting = body.preferences.proactiveGreeting;
  await user.save();

  return ok(res, publicUser(user));
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { assertPinOk } from '../lib/pinAuth';
import { config } from '../config';
import { applyDueGuardianPending, guardianStateDto, noticeGuardian, DEFAULT_CEILING_PAISA } from '../lib/guardian';

const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
const phoneSchema = z.string().regex(/^\+92\d{10}$/, 'Phone must be +92XXXXXXXXXX');

/** Loads the caller and settles any due (cooled-off) guardian change before answering. */
async function currentUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return applyDueGuardianPending(user);
}

/** GET /guardian */
export async function getGuardian(req: Request, res: Response) {
  return ok(res, guardianStateDto(await currentUser(req.userId)));
}

/**
 * PUT /guardian — nominate the trusted contact.
 *
 * A FIRST nomination is tightening, so it is instant. REPLACING a live guardian is not:
 * an instant swap to a colluding account would defeat the whole feature, so it cools off
 * like a removal and the outgoing guardian keeps authority (and is told) until it is due.
 * Re-nominating the SAME person is tightening again — instant, and it cancels a scheduled
 * removal. The ceiling carries over from the previous guardian, or starts at the default.
 */
export async function setGuardian(req: Request, res: Response) {
  const { phone, pin } = z.object({ phone: phoneSchema, pin: pinSchema }).parse(req.body);
  const user = await currentUser(req.userId);
  await assertPinOk(user, pin);

  const guardian = await User.findOne({ phone });
  if (!guardian) throw new ApiError(404, 'USER_NOT_FOUND', 'No PAYO user with that phone');
  if (String(guardian._id) === req.userId)
    throw new ApiError(400, 'SELF_GUARDIAN', 'You cannot be your own trusted contact');

  const isReplacement = !!user.guardian && String(user.guardian.userId) !== String(guardian._id);
  if (isReplacement) {
    const effectiveAt = new Date(Date.now() + config.guardianCoolingMs);
    await noticeGuardian(user, 'replace', effectiveAt);
    user.set('guardianPending', {
      change: 'replace', userId: guardian._id, phone: guardian.phone, name: guardian.name, effectiveAt,
    });
    await user.save();
    await applyDueGuardianPending(user);
    return ok(res, guardianStateDto(user));
  }

  user.set('guardian', {
    userId: guardian._id, phone: guardian.phone, name: guardian.name,
    ceilingPaisa: user.guardian?.ceilingPaisa ?? DEFAULT_CEILING_PAISA,
    since: user.guardian?.since ?? new Date(),
  });
  user.set('guardianPending', undefined);
  await user.save();
  return ok(res, guardianStateDto(user));
}

/**
 * DELETE /guardian — loosening, so it cools off. With `GUARDIAN_COOLING_MS = 0` (the demo)
 * it applies straight away; otherwise it is scheduled and the OLD rule keeps applying until
 * the next read finds it due. Either way the guardian is told.
 */
export async function removeGuardian(req: Request, res: Response) {
  const { pin } = z.object({ pin: pinSchema }).parse(req.body ?? {});
  const user = await currentUser(req.userId);
  await assertPinOk(user, pin);
  if (!user.guardian) throw new ApiError(404, 'NO_GUARDIAN', 'No trusted contact set');

  const effectiveAt = new Date(Date.now() + config.guardianCoolingMs);
  await noticeGuardian(user, 'remove', effectiveAt);
  user.set('guardianPending', { change: 'remove', effectiveAt });
  await user.save();
  await applyDueGuardianPending(user);
  return ok(res, guardianStateDto(user));
}

/** PATCH /guardian/ceiling — lowering is instant (tightening); raising cools off. */
export async function updateCeiling(req: Request, res: Response) {
  const { ceilingPaisa, pin } = z.object({
    ceilingPaisa: z.number().int().nonnegative(),
    pin: pinSchema,
  }).parse(req.body);
  const user = await currentUser(req.userId);
  await assertPinOk(user, pin);
  if (!user.guardian) throw new ApiError(404, 'NO_GUARDIAN', 'No trusted contact set');

  if (ceilingPaisa <= user.guardian.ceilingPaisa) {
    user.guardian.ceilingPaisa = ceilingPaisa;
    user.set('guardianPending', undefined);
    await user.save();
    return ok(res, guardianStateDto(user));
  }

  const effectiveAt = new Date(Date.now() + config.guardianCoolingMs);
  await noticeGuardian(user, 'raise', effectiveAt, { ceilingPaisa });
  user.set('guardianPending', { change: 'raise', ceilingPaisa, effectiveAt });
  await user.save();
  await applyDueGuardianPending(user);
  return ok(res, guardianStateDto(user));
}

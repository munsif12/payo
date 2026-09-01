import { Request, Response } from 'express';
import { z } from 'zod';
import { Card } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';

type CardDoc = InstanceType<typeof Card>;
const cardDto = (c: CardDoc) => ({
  id: String(c._id), pan: c.pan, cvv: c.cvv, expiry: c.expiry, frozen: c.frozen,
});

export async function myCard(req: Request, res: Response) {
  const card = await Card.findOne({ userId: req.userId });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return ok(res, cardDto(card));
}

export async function freezeCard(req: Request, res: Response) {
  const { frozen } = z.object({ frozen: z.boolean() }).parse(req.body);
  const card = await Card.findOneAndUpdate({ userId: req.userId }, { frozen }, { new: true });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return ok(res, cardDto(card));
}

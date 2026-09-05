import { Request, Response } from 'express';
import { z } from 'zod';
import { Card } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { createPendingAction, toActionDto } from '../lib/pendingActions';

type CardDoc = InstanceType<typeof Card>;
const last4Of = (pan: string) => pan.replace(/\s+/g, '').slice(-4);
const cardDto = (c: CardDoc) => {
  const last4 = last4Of(c.pan);
  return {
    id: String(c._id), pan: c.pan, cvv: c.cvv, expiry: c.expiry, frozen: c.frozen,
    last4, maskedPan: `•••• •••• •••• ${last4}`,
  };
};

// Public-safe card view (no pan/cvv) — used by actionsController to surface the card
// state after a card_unfreeze execute, same shape as GET /cards/mine minus pan/cvv.
export const publicCardDto = (c: CardDoc) => {
  const last4 = last4Of(c.pan);
  return { last4, maskedPan: `•••• •••• •••• ${last4}`, expiry: c.expiry, frozen: c.frozen };
};

export async function myCard(req: Request, res: Response) {
  const card = await Card.findOne({ userId: req.userId });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return ok(res, cardDto(card));
}

export async function freezeCard(req: Request, res: Response) {
  z.object({ frozen: z.literal(true) }).parse(req.body);
  const card = await Card.findOneAndUpdate({ userId: req.userId }, { frozen: true }, { new: true });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return ok(res, cardDto(card));
}

export async function unfreezeCard(req: Request, res: Response) {
  const card = await Card.findOne({ userId: req.userId });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  if (!card.frozen) throw new ApiError(409, 'CARD_NOT_FROZEN', 'Card is not frozen');

  const action = await createPendingAction({
    userId: req.userId, kind: 'card_unfreeze',
    payload: { cardId: String(card._id) },
    amountPaisa: 0, feePaisa: 0, requiresPin: true,
    summary: { en: 'Unfreeze your card', ur: 'اپنا کارڈ ان فریز کریں' },
    lines: [{ label: { en: 'Card', ur: 'کارڈ' }, value: cardDto(card).maskedPan }],
  });
  return ok(res, toActionDto(action), 201);
}

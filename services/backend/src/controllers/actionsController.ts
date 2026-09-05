import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { PendingAction, Recipient, SavedBiller, Bill, Card, User } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { executeAction, txnDto, toActionDto } from '../lib/pendingActions';
import { publicCardDto } from './cardsController';
import { SEND_KINDS, applyDueGuardianPending, noticeGuardian } from '../lib/guardian';

const REMIND_COOLDOWN_MS = 60 * 1000;

/** Loads a pending action the caller owns, or throws the right 404/410. */
async function ownAction(userId: string, id: unknown) {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id))
    throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const action = await PendingAction.findOne({ _id: id, userId });
  if (!action) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  return action;
}

/** GET /actions/:id — the payer's own action, for polling while a guardian decides. */
export async function getAction(req: Request, res: Response) {
  return ok(res, toActionDto(await ownAction(req.userId, req.params.id)));
}

/**
 * POST /actions/:id/check-in — the scam interruption. "Yes, someone asked me" cancels the
 * action outright (`scam_checkin`); "no" simply records the answer so execute can proceed
 * to whatever gate is next (approval, then PIN).
 */
export async function checkIn(req: Request, res: Response) {
  const { someoneAsked } = z.object({ someoneAsked: z.boolean() }).parse(req.body ?? {});
  const action = await ownAction(req.userId, req.params.id);
  if (action.status !== 'pending' || action.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');

  action.set('checkIn', { answered: true, someoneAsked });
  if (someoneAsked) {
    action.status = 'cancelled';
    action.cancelReason = 'scam_checkin';
  }
  await action.save();
  return ok(res, toActionDto(action));
}

/** POST /actions/:id/remind — re-issue the guardian card, at most once a minute. */
export async function remind(req: Request, res: Response) {
  const action = await ownAction(req.userId, req.params.id);
  if (action.status !== 'pending' || action.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');
  if (!action.approval || action.approval.status !== 'waiting')
    throw new ApiError(409, 'NOT_WAITING', 'This action is not waiting for approval');

  const last = action.approval.remindedAt;
  if (last && Date.now() - last.getTime() < REMIND_COOLDOWN_MS)
    throw new ApiError(429, 'REMIND_TOO_SOON', 'Please wait a minute before reminding again');

  action.approval.remindedAt = new Date();
  await action.save();

  // Re-issue the card on the guardian's side: a notice is what actually surfaces in their
  // digest, so a Remind that only stamped `remindedAt` would nudge nobody. Addressed to the
  // payer's CURRENT guardian, whoever that now is.
  const payer = await User.findById(req.userId);
  if (payer) {
    await applyDueGuardianPending(payer);
    await noticeGuardian(payer, 'reminder', action.expiresAt, { actionId: action._id });
  }
  return ok(res, { reminded: true, action: toActionDto(action) });
}

export async function execute(req: Request, res: Response) {
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body ?? {});
  const { id } = req.params;
  if (typeof id !== 'string') throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const txn = await executeAction(req.userId, id, pin);

  const data: Record<string, unknown> = { transaction: txn ? txnDto(txn) : null };
  const action = await PendingAction.findOne({ _id: id, userId: req.userId });

  if (action && action.kind === 'card_unfreeze') {
    const p = action.payload as { cardId: string };
    const card = await Card.findOne({ _id: p.cardId, userId: req.userId });
    if (card) data.card = publicCardDto(card);
  }

  if (action && SEND_KINDS.includes(action.kind)) {
    const p = action.payload as { institutionId: string; identifier: string; title: string; recipientId?: string };
    if (p.recipientId)
      await Recipient.updateOne({ _id: p.recipientId, userId: req.userId }, { lastUsedAt: new Date() });
    const alreadySaved = await Recipient.exists({ userId: req.userId, institutionId: p.institutionId, identifier: p.identifier });
    data.recipientSuggestion = {
      institutionId: p.institutionId, identifier: p.identifier, title: p.title, alreadySaved: !!alreadySaved,
    };
  }

  if (action && action.kind === 'pay_bill') {
    const p = action.payload as { billId: string };
    const bill = await Bill.findById(p.billId);
    if (bill) {
      const alreadySaved = await SavedBiller.exists({
        userId: req.userId, billerId: bill.billerId, consumerNo: bill.consumerNo,
      });
      data.billerSuggestion = {
        billerId: String(bill.billerId), consumerNo: bill.consumerNo, consumerName: bill.consumerName,
        alreadySaved: !!alreadySaved,
      };
    }
  }

  return ok(res, data);
}

export async function cancel(req: Request, res: Response) {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const cancelled = await PendingAction.findOneAndUpdate(
    { _id: id, userId: req.userId, status: 'pending' }, { status: 'cancelled' });
  if (!cancelled) {
    const exists = await PendingAction.findOne({ _id: id, userId: req.userId });
    if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
    throw new ApiError(410, 'ACTION_GONE', 'Action already handled');
  }
  return ok(res, { cancelled: true });
}

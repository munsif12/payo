import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { PendingAction, Recipient, SavedBiller, Bill, Card } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { executeAction, txnDto } from '../lib/pendingActions';
import { publicCardDto } from './cardsController';

const SEND_KINDS = ['send_money', 'send_money_bank', 'send_money_wallet'];

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

import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { PendingAction } from '../models';
import { ApiError } from '../lib/apiError';
import { ok } from '../lib/respond';
import { executeAction, txnDto } from '../lib/pendingActions';

export async function execute(req: Request, res: Response) {
  const { pin } = z.object({ pin: z.string().optional() }).parse(req.body ?? {});
  const txn = await executeAction(req.userId, req.params.id, pin);
  return ok(res, { transaction: txnDto(txn) });
}

export async function cancel(req: Request, res: Response) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const cancelled = await PendingAction.findOneAndUpdate(
    { _id: id, userId: req.userId, status: 'pending' }, { status: 'cancelled' });
  if (!cancelled) {
    const exists = await PendingAction.findOne({ _id: id, userId: req.userId });
    if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
    throw new ApiError(410, 'ACTION_GONE', 'Action already handled');
  }
  return ok(res, { cancelled: true });
}

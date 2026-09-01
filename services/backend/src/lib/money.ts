import { ClientSession } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { Account, Transaction } from '../models';
import { ApiError } from './apiError';

const refNo = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 10);

export interface PostTxnInput {
  userId: string; type: string; direction: 'in' | 'out';
  amountPaisa: number; feePaisa: number;
  counterparty: { name: string; urduName?: string; detail: string }; category: string;
}

export async function postTransaction(session: ClientSession, i: PostTxnInput) {
  const delta = i.direction === 'out' ? -(i.amountPaisa + i.feePaisa) : i.amountPaisa;
  const guard = i.direction === 'out'
    ? { userId: i.userId, balancePaisa: { $gte: i.amountPaisa + i.feePaisa } }
    : { userId: i.userId };
  const upd = await Account.updateOne(guard, { $inc: { balancePaisa: delta } }, { session });
  if (upd.modifiedCount === 0) throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Not enough balance');
  const [txn] = await Transaction.create([{ ...i, status: 'completed', refNo: `PAYO-${refNo()}` }], { session });
  return txn;
}

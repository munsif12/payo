import mongoose, { ClientSession } from 'mongoose';
import { PendingAction, Transaction, User } from '../models';
import { ApiError } from './apiError';
import { assertPinOk } from './pinAuth';

type PADoc = InstanceType<typeof PendingAction>;
type TxnDoc = InstanceType<typeof Transaction>;
type Executor = (session: ClientSession, action: PADoc) => Promise<TxnDoc>;
const executors = new Map<string, Executor>();
export const registerExecutor = (kind: string, fn: Executor) => executors.set(kind, fn);

export const EXPIRY_MS = 2 * 60 * 1000;

export async function createPendingAction(i: {
  userId: string; kind: string; payload: unknown; amountPaisa: number; feePaisa: number;
  summary: { en: string; ur: string }; lines: { label: { en: string; ur: string }; value: string }[];
  requiresPin?: boolean;
}) {
  return PendingAction.create({ ...i, expiresAt: new Date(Date.now() + EXPIRY_MS) });
}

export const toActionDto = (a: PADoc) => ({
  id: String(a._id), kind: a.kind, amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
  summary: a.summary, lines: a.lines, requiresPin: a.requiresPin,
  expiresAt: a.expiresAt.toISOString(), status: a.status,
});

export const txnDto = (t: TxnDoc) => ({
  id: String(t._id), type: t.type, direction: t.direction, amountPaisa: t.amountPaisa,
  feePaisa: t.feePaisa,
  counterparty: { name: t.counterparty!.name, urduName: t.counterparty!.urduName ?? undefined, detail: t.counterparty!.detail },
  category: t.category, status: t.status, refNo: t.refNo,
  createdAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
});

export async function executeAction(userId: string, actionId: string, pin: string | undefined) {
  if (!mongoose.isValidObjectId(actionId)) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const found = await PendingAction.findOne({ _id: actionId, userId });
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  if (found.status !== 'pending' || found.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');
  if (found.requiresPin) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
    await assertPinOk(user, pin);
  }
  const exec = executors.get(found.kind);
  if (!exec) throw new ApiError(500, 'NO_EXECUTOR', `No executor for ${found.kind}`);

  const claimed = await PendingAction.findOneAndUpdate(
    { _id: actionId, status: 'pending', expiresAt: { $gt: new Date() } },
    { status: 'processing' }, { new: true });
  if (!claimed) throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');

  const session = await mongoose.startSession();
  try {
    let txn: TxnDoc | undefined;
    await session.withTransaction(async () => { txn = await exec(session, claimed); });
    await PendingAction.updateOne({ _id: actionId }, { status: 'completed', resultTxnId: txn!._id });
    return txn!;
  } catch (e) {
    await PendingAction.updateOne({ _id: actionId, status: 'processing' }, { status: 'pending' });
    throw e;
  } finally { await session.endSession(); }
}

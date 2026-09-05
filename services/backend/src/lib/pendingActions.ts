import mongoose, { ClientSession } from 'mongoose';
import { PendingAction, Transaction, User } from '../models';
import { ApiError } from './apiError';
import { assertPinOk } from './pinAuth';

type PADoc = InstanceType<typeof PendingAction>;
type TxnDoc = InstanceType<typeof Transaction>;
export type Executor = (session: ClientSession, action: PADoc) => Promise<TxnDoc | null>;
const executors = new Map<string, Executor>();
export const registerExecutor = (kind: string, fn: Executor) => executors.set(kind, fn);

export const EXPIRY_MS = 2 * 60 * 1000;

export async function createPendingAction(i: {
  userId: string; kind: string; payload: unknown; amountPaisa: number; feePaisa: number;
  summary: { en: string; ur: string }; lines: { label: { en: string; ur: string }; value: string }[];
  requiresPin?: boolean;
  // Guardian / scam gates (v6). `expiryMs` widens the 2-minute window to 30 minutes when
  // an approval or a check-in has to happen inside it.
  approval?: { required: true; guardianId: string; status: 'waiting' } | undefined;
  riskFlags?: string[] | undefined;
  expiryMs?: number | undefined;
}) {
  const { expiryMs, ...rest } = i;
  return PendingAction.create({ ...rest, expiresAt: new Date(Date.now() + (expiryMs ?? EXPIRY_MS)) });
}

export const toActionDto = (a: PADoc) => ({
  id: String(a._id), kind: a.kind, amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
  summary: a.summary, lines: a.lines, requiresPin: a.requiresPin,
  expiresAt: a.expiresAt.toISOString(), status: a.status,
  cancelReason: a.cancelReason ?? null,
  approval: a.approval
    ? {
      required: a.approval.required, guardianId: String(a.approval.guardianId), status: a.approval.status,
      decidedAt: a.approval.decidedAt?.toISOString() ?? null,
      reason: a.approval.reason ?? null,
      remindedAt: a.approval.remindedAt?.toISOString() ?? null,
    }
    : null,
  riskFlags: [...a.riskFlags],
  checkIn: a.checkIn ? { answered: a.checkIn.answered, someoneAsked: a.checkIn.someoneAsked } : null,
});

export const txnDto = (t: TxnDoc) => ({
  id: String(t._id), type: t.type, direction: t.direction, amountPaisa: t.amountPaisa,
  feePaisa: t.feePaisa,
  counterparty: {
    name: t.counterparty!.name, urduName: t.counterparty!.urduName ?? undefined, detail: t.counterparty!.detail,
    institutionLogoUrl: t.counterparty!.institutionLogoUrl ?? undefined,
  },
  category: t.category, status: t.status, refNo: t.refNo,
  createdAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
});

export async function executeAction(userId: string, actionId: string, pin: string | undefined) {
  if (!mongoose.isValidObjectId(actionId)) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  const found = await PendingAction.findOne({ _id: actionId, userId });
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  if (found.status !== 'pending' || found.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');
  // Guardian and scam gates sit BEFORE the PIN check and never replace it: an approved
  // action still needs the payer's own PIN below. A declined/cancelled action has already
  // fallen out above as 410 ACTION_GONE.
  if (found.approval && found.approval.status === 'waiting')
    throw new ApiError(403, 'APPROVAL_REQUIRED', 'Waiting for your trusted contact to approve');
  if (found.riskFlags.length && !found.checkIn?.answered)
    throw new ApiError(403, 'CHECKIN_REQUIRED', 'Answer the safety check first');
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
    let txn: TxnDoc | null = null;
    await session.withTransaction(async () => { txn = await exec(session, claimed); });
    await PendingAction.updateOne(
      { _id: actionId },
      txn ? { status: 'completed', resultTxnId: (txn as TxnDoc)._id } : { status: 'completed' },
    );
    return txn;
  } catch (e) {
    await PendingAction.updateOne({ _id: actionId, status: 'processing' }, { status: 'pending' });
    throw e;
  } finally { await session.endSession(); }
}

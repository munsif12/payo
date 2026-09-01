import { registerExecutor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';
import { Pocket } from '../models';
import { ApiError } from '../lib/apiError';

registerExecutor('pocket_deposit', async (session, a) => {
  const p = a.payload as { pocketId: string; pocketName: string; pocketUrduName?: string };
  const txn = await postTransaction(session, {
    userId: String(a.userId), type: 'pocket_deposit', direction: 'out',
    amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: p.pocketName, urduName: p.pocketUrduName, detail: 'pocket' },
    category: 'savings',
  });
  await Pocket.updateOne({ _id: p.pocketId }, { $inc: { balancePaisa: a.amountPaisa } }, { session });
  return txn;
});

registerExecutor('pocket_withdraw', async (session, a) => {
  const p = a.payload as { pocketId: string; pocketName: string; pocketUrduName?: string };
  const upd = await Pocket.updateOne(
    { _id: p.pocketId, balancePaisa: { $gte: a.amountPaisa } },
    { $inc: { balancePaisa: -a.amountPaisa } }, { session });
  if (upd.modifiedCount === 0) throw new ApiError(400, 'INSUFFICIENT_POCKET_FUNDS', 'Not enough in pocket');
  return postTransaction(session, {
    userId: String(a.userId), type: 'pocket_withdraw', direction: 'in',
    amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: p.pocketName, urduName: p.pocketUrduName, detail: 'pocket' },
    category: 'savings',
  });
});

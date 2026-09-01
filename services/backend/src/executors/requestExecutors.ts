import { registerExecutor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';
import { MoneyRequest, User } from '../models';
import { ApiError } from '../lib/apiError';

registerExecutor('request_settlement', async (session, a) => {
  const p = a.payload as { requestId: string; requesterId: string; requesterName: string; requesterUrduName?: string; requesterPhone: string };
  const claimed = await MoneyRequest.findOneAndUpdate(
    { _id: p.requestId, status: 'pending' }, { status: 'approved' }, { session, new: true });
  if (!claimed) throw new ApiError(410, 'REQUEST_GONE', 'Request already settled');
  const payer = await User.findById(a.userId).session(session);
  const out = await postTransaction(session, {
    userId: String(a.userId), type: 'request_settlement', direction: 'out',
    amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: p.requesterName, urduName: p.requesterUrduName, detail: p.requesterPhone },
    category: 'transfer',
  });
  await postTransaction(session, {
    userId: p.requesterId, type: 'request_settlement', direction: 'in',
    amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: payer!.name, urduName: payer!.urduName ?? undefined, detail: payer!.phone },
    category: 'transfer',
  });
  return out;
});

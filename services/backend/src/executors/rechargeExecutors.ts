import { registerExecutor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';

registerExecutor('recharge', async (session, a) => {
  const p = a.payload as { telcoName: string; telcoUrduName: string; phone: string };
  return postTransaction(session, {
    userId: String(a.userId), type: 'recharge', direction: 'out',
    amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.telcoName, urduName: p.telcoUrduName, detail: p.phone },
    category: 'recharge',
  });
});

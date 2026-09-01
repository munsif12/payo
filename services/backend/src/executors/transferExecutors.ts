import { registerExecutor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';
import { User } from '../models';

registerExecutor('send_money', async (session, a) => {
  const p = a.payload as { recipientUserId: string; recipientName: string; recipientUrduName?: string; phone: string };
  const sender = await User.findById(a.userId).session(session);
  const out = await postTransaction(session, {
    userId: String(a.userId), type: 'p2p', direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.recipientName, urduName: p.recipientUrduName, detail: p.phone }, category: 'transfer',
  });
  await postTransaction(session, {
    userId: p.recipientUserId, type: 'p2p', direction: 'in', amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: sender!.name, urduName: sender!.urduName ?? undefined, detail: sender!.phone }, category: 'transfer',
  });
  return out;
});

registerExecutor('send_money_bank', async (session, a) => {
  const p = a.payload as { bankName: string; iban: string; accountTitle: string };
  return postTransaction(session, {
    userId: String(a.userId), type: 'bank_transfer', direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.accountTitle, detail: `${p.bankName} ****${p.iban.slice(-4)}` }, category: 'transfer',
  });
});

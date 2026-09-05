import { registerExecutor, Executor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';
import { maskIdentifier } from '../lib/resolveRecipient';
import { ApiError } from '../lib/apiError';
import { User } from '../models';

interface TransferPayload {
  institutionId: string; institutionName: string; institutionUrduName: string; institutionKind: 'wallet' | 'bank';
  institutionLogoUrl?: string;
  identifier: string; title: string; linkedUserId?: string; recipientId?: string;
}

// PAYO → PAYO: real linked user, so both sides get a transaction (dual entry). Re-load
// both users at execute time (the pending action may be minutes old) so a recipient
// deleted in the meantime fails with a clear 404 rather than the misleading
// INSUFFICIENT_FUNDS a missing recipient Account would otherwise trigger.
registerExecutor('send_money', async (session, a) => {
  const p = a.payload as TransferPayload;
  const sender = await User.findById(a.userId).session(session);
  if (!sender) throw new ApiError(404, 'NOT_FOUND', 'Sender not found');
  const recipient = await User.findById(p.linkedUserId).session(session);
  if (!recipient) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'Recipient no longer exists');

  const out = await postTransaction(session, {
    userId: String(a.userId), type: 'p2p', direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.title, detail: p.identifier, institutionId: p.institutionId, institutionLogoUrl: p.institutionLogoUrl },
    category: 'transfer',
  });
  await postTransaction(session, {
    userId: String(recipient._id), type: 'p2p', direction: 'in', amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: sender.name, urduName: sender.urduName ?? undefined, detail: sender.phone }, category: 'transfer',
  });
  return out;
});

// Other wallets / banks: no real recipient account here, so it's a debit-only send.
const debitOnly: Executor = async (session, a) => {
  const p = a.payload as TransferPayload;
  const type = p.institutionKind === 'bank' ? 'bank_transfer' : 'p2p';
  return postTransaction(session, {
    userId: String(a.userId), type, direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: {
      name: p.title, detail: `${p.institutionName} ${maskIdentifier(p.identifier)}`,
      institutionId: p.institutionId, institutionLogoUrl: p.institutionLogoUrl,
    },
    category: 'transfer',
  });
};
registerExecutor('send_money_bank', debitOnly);
registerExecutor('send_money_wallet', debitOnly);

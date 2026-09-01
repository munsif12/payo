import { registerExecutor } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';
import { Bill, Biller } from '../models';
import { ApiError } from '../lib/apiError';

registerExecutor('pay_bill', async (session, a) => {
  const { billId } = a.payload as { billId: string };
  const bill = await Bill.findOneAndUpdate(
    { _id: billId, status: 'due' }, { status: 'paid' }, { session, new: true });
  if (!bill) throw new ApiError(410, 'ALREADY_PAID', 'Bill already paid');
  const biller = await Biller.findById(bill.billerId).session(session);
  return postTransaction(session, {
    userId: String(a.userId), type: 'bill', direction: 'out',
    amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: biller!.name, urduName: biller!.urduName, detail: bill.consumerNo },
    category: 'bills',
  });
});

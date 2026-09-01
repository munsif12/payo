import mongoose from 'mongoose';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Transaction } from '../../models';
import { postTransaction } from '../money';

const app = createApp();

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

test('out txn debits amount+fee and writes txn doc', async () => {
  const { userId } = await createVerifiedUser(app);
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await postTransaction(session, {
      userId, type: 'bank_transfer', direction: 'out', amountPaisa: 500000, feePaisa: 2500,
      counterparty: { name: 'Bhai Jan', detail: 'Meezan ****1234' }, category: 'transfer',
    });
  });
  await session.endSession();
  expect(await balance(userId)).toBe(1_000_000 - 502_500);
  const txn = await Transaction.findOne({ userId });
  expect(txn!.refNo).toMatch(/^PAYO-/);
});

test('insufficient funds rejects atomically — no txn doc, balance unchanged', async () => {
  const { userId } = await createVerifiedUser(app);
  const session = await mongoose.startSession();
  await expect(session.withTransaction(async () => {
    await postTransaction(session, {
      userId, type: 'p2p', direction: 'out', amountPaisa: 2_000_000, feePaisa: 0,
      counterparty: { name: 'X', detail: 'x' }, category: 'transfer',
    });
  })).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  await session.endSession();
  expect(await balance(userId)).toBe(1_000_000);
  expect(await Transaction.countDocuments({ userId })).toBe(0);
});

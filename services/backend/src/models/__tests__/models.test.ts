import { User, Account, PendingAction } from '..';

test('duplicate email rejected', async () => {
  const base = { name: 'A', phone: '+920000000001', pinHash: 'x' };
  await User.create({ ...base, email: 'a@x.com' });
  await expect(User.create({ ...base, phone: '+920000000002', email: 'a@x.com' })).rejects.toThrow();
});

test('account balance cannot be negative at validation level', async () => {
  const u = await User.create({ name: 'A', email: 'b@x.com', phone: '+920000000003', pinHash: 'x' });
  await expect(Account.create({ userId: u._id, balancePaisa: -1 })).rejects.toThrow();
});

test('pending action defaults', async () => {
  const u = await User.create({ name: 'A', email: 'c@x.com', phone: '+920000000004', pinHash: 'x' });
  const pa = await PendingAction.create({
    userId: u._id, kind: 'send_money', payload: {}, amountPaisa: 100, feePaisa: 0,
    summary: { en: 's', ur: 'س' }, lines: [], expiresAt: new Date(Date.now() + 120000),
  });
  expect(pa.status).toBe('pending');
  expect(pa.requiresPin).toBe(true);
});

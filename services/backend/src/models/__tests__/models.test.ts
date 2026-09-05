import { User, Account, PendingAction, Bill, Biller } from '..';

test('creating a user without email or pin works', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000001' });
  expect(u.pinSet).toBe(false);
  expect(u.email).toBeUndefined();
  expect(u.pinHash).toBeUndefined();
});

test('duplicate phone rejected', async () => {
  await User.create({ name: 'A', phone: '+920000000002' });
  await expect(User.create({ name: 'B', phone: '+920000000002' })).rejects.toThrow();
});

test('account balance cannot be negative at validation level', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000003' });
  await expect(Account.create({ userId: u._id, balancePaisa: -1 })).rejects.toThrow();
});

test('pending action defaults', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000004' });
  const pa = await PendingAction.create({
    userId: u._id, kind: 'send_money', payload: {}, amountPaisa: 100, feePaisa: 0,
    summary: { en: 's', ur: 'س' }, lines: [], expiresAt: new Date(Date.now() + 120000),
  });
  expect(pa.status).toBe('pending');
  expect(pa.requiresPin).toBe(true);
});

test('bill accepts userId', async () => {
  const u = await User.create({ name: 'A', phone: '+920000000005' });
  const biller = await Biller.create({ name: 'K-Electric', urduName: 'کے الیکٹرک', category: 'electricity', domain: 'ke.com.pk' });
  const bill = await Bill.create({
    billerId: biller._id, consumerNo: '1234567890', consumerName: 'A',
    amountPaisa: 1000, dueDate: new Date(), month: '2026-09', userId: u._id,
  });
  expect(String(bill.userId)).toBe(String(u._id));
});

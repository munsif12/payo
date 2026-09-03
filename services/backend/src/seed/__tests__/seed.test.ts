import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { runSeed } from '../seed';
import { User, Account, Transaction, Bill, Pocket, Bank, Biller, Telco, Contact } from '../../models';

const app = createApp();

async function hasUniqueIndex(collection: string, key: Record<string, 1 | -1>) {
  const indexes = await mongoose.connection.collection(collection).indexes();
  return indexes.some((idx) =>
    idx.unique === true && JSON.stringify(idx.key) === JSON.stringify(key));
}

test('seed builds the Contract 4 demo world', async () => {
  await runSeed();

  expect(await User.countDocuments()).toBe(6);
  const ammi = (await User.findOne({ email: 'ammi@payo.demo' }))!;
  expect((await Account.findOne({ userId: ammi._id }))!.balancePaisa).toBe(8_450_000);
  expect(ammi.language).toBe('en');

  const txns = await Transaction.find({ userId: ammi._id });
  expect(txns.length).toBeGreaterThanOrEqual(60);
  const months = new Set(txns.map(t =>
    `${(t as unknown as { createdAt: Date }).createdAt.getFullYear()}-${(t as unknown as { createdAt: Date }).createdAt.getMonth()}`));
  expect(months.size).toBeGreaterThanOrEqual(3);

  expect(await Bill.countDocuments({ status: 'due' })).toBe(1);
  const pocket = (await Pocket.findOne({ userId: ammi._id }))!;
  expect(pocket.balancePaisa).toBe(12_000_000);
  expect(pocket.urduName).toBe('عمرہ فنڈ');

  expect(await Bank.countDocuments()).toBe(5);
  expect(await Biller.countDocuments()).toBe(4);
  expect(await Telco.countDocuments()).toBe(4);
  expect(await Contact.countDocuments({ userId: ammi._id })).toBe(4);

  // seeded users are already onboarded — phone + OTP + PIN, no signup step
  const r = await request(app).post('/api/v1/auth/request-otp').send({ phone: ammi.phone });
  expect(r.body.data.isNewUser).toBe(false);
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ phone: ammi.phone, otp: r.body.data.demoOtp });
  expect(v.body.data.pinSet).toBe(true);
  const login = await request(app).post('/api/v1/auth/verify-pin')
    .set('Authorization', `Bearer ${v.body.data.otpToken}`).send({ pin: '1234' });
  expect(login.status).toBe(200);
  expect(login.body.data.token).toBeTruthy();

  // dropDatabase() during runSeed() wipes every collection's indexes — confirm the
  // reseed step rebuilds them for models beyond just User/Bill.
  expect(await hasUniqueIndex('transactions', { refNo: 1 })).toBe(true);
  expect(await hasUniqueIndex('otpcodes', { phone: 1 })).toBe(true);
}, 60_000);

test('seed is idempotent — re-run lands on the same world', async () => {
  await runSeed();
  await runSeed();
  expect(await User.countDocuments()).toBe(6);
  const ammi = (await User.findOne({ email: 'ammi@payo.demo' }))!;
  expect((await Account.findOne({ userId: ammi._id }))!.balancePaisa).toBe(8_450_000);
}, 120_000);

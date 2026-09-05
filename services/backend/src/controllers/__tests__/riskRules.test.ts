import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Institution, User } from '../../models';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const makePayo = () =>
  Institution.create({ name: 'PAYO', urduName: 'پیو', kind: 'wallet', code: 'PAYO', popular: true, domain: 'payo.app' });

/** Backdates a user's DOB so the age-dependent rules can be exercised. */
const setAge = (userId: string, years: number) =>
  User.updateOne({ _id: userId }, {
    dateOfBirth: new Date(new Date().getFullYear() - years, new Date().getMonth(), 1),
  });

const send = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/v1/transfers').set(auth(token)).send(body);

const execute = (token: string, id: string) =>
  request(app).post(`/api/v1/actions/${id}/execute`).set(auth(token)).send({ pin: '1234' });

const setGuardian = (token: string, phone: string) =>
  request(app).put('/api/v1/guardian').set(auth(token)).send({ phone, pin: '1234' });

// --- who gets asked the scam question ---

test('senior: a new recipient at Rs 30,000 is check-in gated', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 70);

  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  expect(res.body.data.riskFlags).toEqual(['new_recipient_large']);
  const blocked = await execute(a.token, res.body.data.id);
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('CHECKIN_REQUIRED');
});

test('non-senior: the same Rs 30,000 to a new recipient is NOT check-in gated, but does need approval', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 35);
  await setGuardian(a.token, g.user.phone);

  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  expect(res.body.data.riskFlags).toEqual([]);
  expect(res.body.data.approval).toMatchObject({ status: 'waiting' });

  const blocked = await execute(a.token, res.body.data.id);
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('APPROVAL_REQUIRED'); // the approval gate, never the check-in
});

test('a small Rs 1,000 send to a brand-new recipient needs neither approval nor a check-in', async () => {
  for (const years of [70, 35]) {
    const a = await createVerifiedUser(app);
    const b = await createVerifiedUser(app);
    const g = await createVerifiedUser(app);
    const payo = await makePayo();
    await setAge(a.userId, years);
    await setGuardian(a.token, g.user.phone);

    const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000 });
    expect(res.body.data.approval).toBeNull();
    expect(res.body.data.riskFlags).toEqual([]);
    expect((await execute(a.token, res.body.data.id)).status).toBe(200);
    await Institution.deleteMany({});
  }
});

test('non-senior: a new recipient at or above the ceiling still gets a check-in', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 35);

  const res = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 10_000_000 });
  expect(res.body.data.riskFlags).toEqual(['new_recipient_large']);
  const blocked = await execute(a.token, res.body.data.id);
  expect(blocked.body.code).toBe('CHECKIN_REQUIRED');
});

// --- the senior 24-hour clearance ---

test('senior: answering "no" clears the same recipient for 24 h, and only that recipient', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const c = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 70);
  // Enough to actually complete the retry — 3,000,000 is still "large" on the absolute
  // ₨20,000 arm, so the first send is flagged regardless of the bigger balance.
  await Account.updateOne({ userId: a.userId }, { balancePaisa: 20_000_000 });

  const first = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  expect(first.body.data.riskFlags).toEqual(['new_recipient_large']);
  await request(app).post(`/api/v1/actions/${first.body.data.id}/check-in`)
    .set(auth(a.token)).send({ someoneAsked: false });
  await request(app).post(`/api/v1/actions/${first.body.data.id}/cancel`).set(auth(a.token)).send({});

  const again = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  expect(again.body.data.riskFlags).toEqual([]);
  expect((await execute(a.token, again.body.data.id)).status).toBe(200);

  // A different recipient is not covered by that answer.
  const other = await send(a.token, { to: { institutionId: String(payo._id), identifier: c.user.phone }, amountPaisa: 3_000_000 });
  expect(other.body.data.riskFlags).toEqual(['new_recipient_large']);
});

test('senior: a "yes" answer clears nothing — the next attempt asks again', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 70);

  const first = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  await request(app).post(`/api/v1/actions/${first.body.data.id}/check-in`)
    .set(auth(a.token)).send({ someoneAsked: true });

  const again = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 3_000_000 });
  expect(again.body.data.riskFlags).toEqual(['new_recipient_large']);
});

// --- the pressure flag is scoped to the recipient the AI heard about ---

test('pressure_language applies to the named recipient and is dropped for any other', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const c = await createVerifiedUser(app);
  const payo = await makePayo();
  await setAge(a.userId, 35);

  const matched = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000,
    riskFlags: ['pressure_language'],
    riskTarget: { institutionId: String(payo._id), identifier: b.user.phone },
  });
  expect(matched.body.data.riskFlags).toEqual(['pressure_language']);

  const mismatched = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: c.user.phone }, amountPaisa: 100_000,
    riskFlags: ['pressure_language'],
    riskTarget: { institutionId: String(payo._id), identifier: b.user.phone },
  });
  expect(mismatched.body.data.riskFlags).toEqual([]);
  expect((await execute(a.token, mismatched.body.data.id)).status).toBe(200);
});

test('riskTarget matches however the phone was typed, and an absent riskTarget applies the flag as before', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const payo = await makePayo();
  const local = `0${b.user.phone.slice(3)}`; // +923001110002 → 03001110002

  const normalised = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000,
    riskFlags: ['pressure_language'],
    riskTarget: { institutionId: String(payo._id), identifier: local },
  });
  expect(normalised.body.data.riskFlags).toEqual(['pressure_language']);

  const untargeted = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 100_000,
    riskFlags: ['pressure_language'],
  });
  expect(untargeted.body.data.riskFlags).toEqual(['pressure_language']);
});

test('an applied pressure flag forces approval whatever the amount', async () => {
  const a = await createVerifiedUser(app);
  const b = await createVerifiedUser(app);
  const g = await createVerifiedUser(app);
  const payo = await makePayo();
  await setGuardian(a.token, g.user.phone);

  const flagged = await send(a.token, {
    to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 50_000,
    riskFlags: ['pressure_language'],
    riskTarget: { institutionId: String(payo._id), identifier: b.user.phone },
  });
  expect(flagged.body.data.approval).toMatchObject({ status: 'waiting' });

  // The same amount to the same person WITHOUT the flag stays frictionless.
  const clean = await send(a.token, { to: { institutionId: String(payo._id), identifier: b.user.phone }, amountPaisa: 50_000 });
  expect(clean.body.data.approval).toBeNull();
});

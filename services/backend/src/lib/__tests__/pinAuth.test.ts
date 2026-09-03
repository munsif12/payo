import { User } from '../../models';
import { assertPinOk } from '../pinAuth';

async function makeUser(phone: string) {
  const bcrypt = await import('bcryptjs');
  const pinHash = await bcrypt.hash('1234', 10);
  return User.create({ name: 'Test', phone, pinHash, pinSet: true });
}

test('two parallel wrong-PIN attempts land exactly 2 on the counter (atomic $inc, no lost update)', async () => {
  const user = await makeUser('+923009990001');

  await Promise.all([
    assertPinOk(user, '0000').catch(() => {}),
    assertPinOk(user, '0000').catch(() => {}),
  ]);

  const fresh = await User.findById(user._id);
  expect(fresh!.pinAttempts).toBe(2);
});

test('a correct PIN still passes and clears any prior attempts', async () => {
  const user = await makeUser('+923009990002');
  await assertPinOk(user, '0000').catch(() => {});
  // Callers always re-fetch the user before checking the PIN (see pendingActions.ts) —
  // mirror that here so the reset branch sees the DB's incremented pinAttempts.
  const reloaded = (await User.findById(user._id))!;
  await expect(assertPinOk(reloaded, '1234')).resolves.toBeUndefined();
  const fresh = await User.findById(user._id);
  expect(fresh!.pinAttempts).toBe(0);
  expect(fresh!.pinLockedUntil).toBeFalsy();
});

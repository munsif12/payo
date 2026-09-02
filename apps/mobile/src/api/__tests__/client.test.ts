import { shouldSignOut } from '../authGuard';

test('401 on an authenticated route signs the user out', () => {
  expect(shouldSignOut(401, '/me', true)).toBe(true);
  expect(shouldSignOut(401, '/transactions?limit=20', true)).toBe(true);
});

test('401 on auth routes (wrong PIN / bad OTP) does not sign out', () => {
  expect(shouldSignOut(401, '/auth/login', true)).toBe(false);
  expect(shouldSignOut(401, '/auth/verify-pin', true)).toBe(false);
});

test('non-401 errors and already-signed-out state do not sign out', () => {
  expect(shouldSignOut(400, '/me', true)).toBe(false);
  expect(shouldSignOut(401, '/me', false)).toBe(false);
  expect(shouldSignOut(undefined, '/me', true)).toBe(false);
});

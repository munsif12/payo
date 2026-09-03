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

test('/actions/:id/execute is exempted by error CODE, not URL', () => {
  // A dead session hitting execute still signs out, like anywhere else.
  expect(shouldSignOut(401, '/actions/abc123/execute', true, 'SESSION_EXPIRED')).toBe(true);
  expect(shouldSignOut(401, '/actions/abc123/execute', true, 'UNAUTHORIZED')).toBe(true);
  expect(shouldSignOut(401, '/actions/abc123/execute', true, 'OTP_SCOPE')).toBe(true);
  // A mistyped or locked-out PIN never signs out, on execute or elsewhere.
  expect(shouldSignOut(401, '/actions/abc123/execute', true, 'INVALID_PIN')).toBe(false);
  expect(shouldSignOut(401, '/actions/abc123/execute', true, 'PIN_LOCKED')).toBe(false);
  expect(shouldSignOut(401, '/me', true, 'INVALID_PIN')).toBe(false);
  expect(shouldSignOut(401, '/me', true, 'PIN_LOCKED')).toBe(false);
});

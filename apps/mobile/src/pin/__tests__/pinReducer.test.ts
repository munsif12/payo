import { pinReducer, initialPinState, PIN_LENGTH } from '../pinReducer';

describe('pinReducer', () => {
  test('digit appends and clears any prior error', () => {
    const withError = { ...initialPinState, error: 'oops' };
    const next = pinReducer(withError, { type: 'digit', digit: '1' });
    expect(next.digits).toBe('1');
    expect(next.error).toBeNull();
  });

  test('digit stops accepting input at PIN_LENGTH', () => {
    let state = initialPinState;
    for (const d of ['1', '2', '3', '4', '5']) {
      state = pinReducer(state, { type: 'digit', digit: d });
    }
    expect(state.digits).toBe('1234');
    expect(state.digits.length).toBe(PIN_LENGTH);
  });

  test('digit is a no-op while locked', () => {
    const locked = { ...initialPinState, locked: true };
    const next = pinReducer(locked, { type: 'digit', digit: '1' });
    expect(next).toEqual(locked);
  });

  test('digit is a no-op while submitting', () => {
    const submitting = { ...initialPinState, submitting: true };
    const next = pinReducer(submitting, { type: 'digit', digit: '1' });
    expect(next).toEqual(submitting);
  });

  test('backspace removes the last digit', () => {
    const state = { ...initialPinState, digits: '12' };
    const next = pinReducer(state, { type: 'backspace' });
    expect(next.digits).toBe('1');
  });

  test('backspace on empty digits is a no-op', () => {
    const next = pinReducer(initialPinState, { type: 'backspace' });
    expect(next).toEqual(initialPinState);
  });

  test('backspace is a no-op while locked or submitting', () => {
    const locked = { ...initialPinState, digits: '12', locked: true };
    expect(pinReducer(locked, { type: 'backspace' })).toEqual(locked);
    const submitting = { ...initialPinState, digits: '12', submitting: true };
    expect(pinReducer(submitting, { type: 'backspace' })).toEqual(submitting);
  });

  test('submitStart sets submitting and clears error', () => {
    const state = { ...initialPinState, digits: '1234', error: 'x' };
    const next = pinReducer(state, { type: 'submitStart' });
    expect(next.submitting).toBe(true);
    expect(next.error).toBeNull();
  });

  test('invalidPin clears digits, sets error, stops submitting, bumps shakeToken', () => {
    const state = { ...initialPinState, digits: '1234', submitting: true, shakeToken: 0 };
    const next = pinReducer(state, { type: 'invalidPin', message: 'Wrong PIN' });
    expect(next.digits).toBe('');
    expect(next.submitting).toBe(false);
    expect(next.error).toBe('Wrong PIN');
    expect(next.shakeToken).toBe(1);
  });

  test('invalidPin twice keeps bumping shakeToken so the UI can re-trigger shake', () => {
    let state = { ...initialPinState, digits: '1234', submitting: true };
    state = pinReducer(state, { type: 'invalidPin', message: 'Wrong PIN' });
    state = { ...state, digits: '1234', submitting: true };
    state = pinReducer(state, { type: 'invalidPin', message: 'Wrong PIN' });
    expect(state.shakeToken).toBe(2);
  });

  test('locked sets locked true and keeps the server message', () => {
    const state = { ...initialPinState, digits: '1234', submitting: true };
    const next = pinReducer(state, { type: 'locked', message: 'Too many attempts' });
    expect(next.locked).toBe(true);
    expect(next.digits).toBe('');
    expect(next.submitting).toBe(false);
    expect(next.error).toBe('Too many attempts');
  });

  test('generic error clears digits and stops submitting without locking', () => {
    const state = { ...initialPinState, digits: '1234', submitting: true };
    const next = pinReducer(state, { type: 'error', message: 'Timed out' });
    expect(next.locked).toBe(false);
    expect(next.digits).toBe('');
    expect(next.error).toBe('Timed out');
  });

  test('reset returns to the initial state', () => {
    const state = { digits: '12', submitting: true, locked: true, error: 'x', shakeToken: 3 };
    expect(pinReducer(state, { type: 'reset' })).toEqual(initialPinState);
  });
});

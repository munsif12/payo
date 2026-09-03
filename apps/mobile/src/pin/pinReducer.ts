// Pure state machine for the PIN bottom sheet — digits entry, submit lifecycle,
// error/lockout, and a shake token the UI bumps on every wrong-PIN attempt.
// No RTK/API imports here: usePinSheet.tsx wires this reducer to the actual
// executeAction mutation; this file only owns the shape of the local state.

export const PIN_LENGTH = 4;

export interface PinState {
  digits: string;
  submitting: boolean;
  locked: boolean;
  error: string | null;
  /** Bumped on every INVALID_PIN so the sheet can trigger PinDots.shake() via an effect. */
  shakeToken: number;
}

export const initialPinState: PinState = {
  digits: '',
  submitting: false,
  locked: false,
  error: null,
  shakeToken: 0,
};

export type PinAction =
  | { type: 'digit'; digit: string }
  | { type: 'backspace' }
  | { type: 'submitStart' }
  | { type: 'invalidPin'; message: string }
  | { type: 'locked'; message: string }
  | { type: 'error'; message: string }
  | { type: 'reset' };

export function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case 'digit': {
      if (state.locked || state.submitting) return state;
      if (state.digits.length >= PIN_LENGTH) return state;
      return { ...state, digits: state.digits + action.digit, error: null };
    }
    case 'backspace': {
      if (state.locked || state.submitting) return state;
      if (!state.digits.length) return state;
      return { ...state, digits: state.digits.slice(0, -1), error: null };
    }
    case 'submitStart':
      return { ...state, submitting: true, error: null };
    case 'invalidPin':
      return {
        ...state,
        submitting: false,
        digits: '',
        error: action.message,
        shakeToken: state.shakeToken + 1,
      };
    case 'locked':
      return { ...state, submitting: false, digits: '', locked: true, error: action.message };
    case 'error':
      return { ...state, submitting: false, digits: '', error: action.message };
    case 'reset':
      return initialPinState;
    default:
      return state;
  }
}

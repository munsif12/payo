import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinSheet } from '../ui/PinSheet';
import { useExecuteActionMutation, apiErr } from '../api/client';
import { markActionDone } from '../store/pendingActionHolder';
import { pinReducer, initialPinState, PIN_LENGTH } from './pinReducer';
import type { PendingAction, Txn, CardSummary, RecipientSuggestion, BillerSuggestion } from '../api/types';

export interface PinSheetResolution {
  /** null for a PIN-gated action that moves no money — `card_unfreeze` (F1.2)
   *  answers `{ transaction: null, card }`. Every consumer must be null-safe. */
  transaction: Txn | null;
  /** Present only for card actions (`card_unfreeze`): the card's new state. */
  card?: CardSummary;
  recipientSuggestion?: RecipientSuggestion;
  billerSuggestion?: BillerSuggestion;
}

/** Second mode for the sheet (v6). Given, the typed PIN is handed to `execute`
 *  instead of POST /actions/:id/execute — the guardian's approval posts it to
 *  POST /approvals/:id/approve, and Settings posts it to the guardian routes.
 *  Everything else (4-digit auto-submit, INVALID_PIN / PIN_LOCKED handling, the
 *  shake, cancel semantics) is unchanged, so there is exactly one PIN UI. */
export interface PinSheetOptions {
  /** Must reject with an RTK error whose `data.code` is INVALID_PIN / PIN_LOCKED
   *  for the sheet to keep itself open and shake, as the execute path does. */
  execute: (pin: string) => Promise<PinSheetResolution | void>;
}

interface PinSheetContextValue {
  /** Opens the sheet for the given pending action; resolves with the executed
   *  transaction (null for a non-money action such as card_unfreeze, which
   *  resolves with `card` instead) + optional save suggestions, or rejects with an Error whose
   *  message is 'cancelled' if the user swipes down / taps Cancel / the backdrop.
   *  With `opts.execute` the sheet runs that instead of the execute endpoint
   *  (guardian approval, guardian settings) — see PinSheetOptions. */
  openPinSheet: (action: PendingAction, opts?: PinSheetOptions) => Promise<PinSheetResolution>;
  /** True while the sheet is showing. The voice loop pauses listening on this so
   *  PIN audio never reaches the AI service. */
  isOpen: boolean;
}

const PinSheetContext = createContext<PinSheetContextValue | null>(null);

export function usePinSheet(): PinSheetContextValue {
  const ctx = useContext(PinSheetContext);
  if (!ctx) throw new Error('usePinSheet must be used within a PinSheetProvider');
  return ctx;
}

export function PinSheetProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [action, setAction] = useState<PendingAction | null>(null);
  const [state, dispatch] = useReducer(pinReducer, initialPinState);
  const [execute] = useExecuteActionMutation();
  const resolverRef = useRef<{ resolve: (v: PinSheetResolution) => void; reject: (e: Error) => void } | null>(null);
  /** Non-null while the sheet is running in the alternate (guardian) mode. */
  const executorRef = useRef<PinSheetOptions['execute'] | null>(null);

  const openPinSheet = useCallback((a: PendingAction, opts?: PinSheetOptions) => {
    return new Promise<PinSheetResolution>((resolve, reject) => {
      // A sheet is already open for another action — reject the new request
      // instead of overwriting resolverRef, which would silently orphan the
      // first caller's promise (it would never resolve or reject).
      if (resolverRef.current) {
        reject(new Error('busy'));
        return;
      }
      resolverRef.current = { resolve, reject };
      executorRef.current = opts?.execute ?? null;
      dispatch({ type: 'reset' });
      setAction(a);
    });
  }, []);

  const close = useCallback((reason: string) => {
    resolverRef.current?.reject(new Error(reason));
    resolverRef.current = null;
    executorRef.current = null;
    setAction(null);
    dispatch({ type: 'reset' });
  }, []);

  const submit = useCallback(async (currentAction: PendingAction, pin: string) => {
    dispatch({ type: 'submitStart' });
    try {
      const custom = executorRef.current;
      let result: PinSheetResolution;
      if (custom) {
        // Guardian mode: the caller owns the request. Deliberately NOT
        // markActionDone — approving somebody else's send does not execute it,
        // and this device's action registry is about the payer's own actions.
        result = (await custom(pin)) ?? { transaction: null };
      } else {
        result = await execute({ id: currentAction.id, pin }).unwrap();
        markActionDone(currentAction.id);
      }
      resolverRef.current?.resolve(result);
      resolverRef.current = null;
      executorRef.current = null;
      setAction(null);
      dispatch({ type: 'reset' });
    } catch (e) {
      const err = apiErr(e);
      if (err.code === 'PIN_LOCKED') {
        dispatch({ type: 'locked', message: err.message });
      } else if (err.code === 'INVALID_PIN') {
        dispatch({ type: 'invalidPin', message: t('confirm.wrongPin') });
      } else {
        dispatch({ type: 'error', message: err.message });
      }
    }
  }, [execute, t]);

  // Auto-submit on the 4th digit.
  useEffect(() => {
    if (action && state.digits.length === PIN_LENGTH && !state.submitting && !state.locked) {
      submit(action, state.digits);
    }
  }, [action, state.digits, state.submitting, state.locked, submit]);

  const onDigit = useCallback((d: string) => dispatch({ type: 'digit', digit: d }), []);
  const onBackspace = useCallback(() => dispatch({ type: 'backspace' }), []);
  const onClose = useCallback(() => close('cancelled'), [close]);

  const value = useMemo(() => ({ openPinSheet, isOpen: action != null }), [openPinSheet, action]);

  return (
    <PinSheetContext.Provider value={value}>
      {children}
      <PinSheet
        visible={!!action}
        action={action}
        state={state}
        onDigit={onDigit}
        onBackspace={onBackspace}
        onClose={onClose}
      />
    </PinSheetContext.Provider>
  );
}

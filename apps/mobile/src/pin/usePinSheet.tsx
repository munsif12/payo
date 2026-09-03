import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinSheet } from '../ui/PinSheet';
import { useExecuteActionMutation, apiErr } from '../api/client';
import { markActionDone } from '../store/pendingActionHolder';
import { pinReducer, initialPinState, PIN_LENGTH } from './pinReducer';
import type { PendingAction, Txn, RecipientSuggestion, BillerSuggestion } from '../api/types';

export interface PinSheetResolution {
  transaction: Txn;
  recipientSuggestion?: RecipientSuggestion;
  billerSuggestion?: BillerSuggestion;
}

interface PinSheetContextValue {
  /** Opens the sheet for the given pending action; resolves with the executed
   *  transaction (+ optional save suggestions), or rejects with an Error whose
   *  message is 'cancelled' if the user swipes down / taps Cancel / the backdrop. */
  openPinSheet: (action: PendingAction) => Promise<PinSheetResolution>;
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

  const openPinSheet = useCallback((a: PendingAction) => {
    return new Promise<PinSheetResolution>((resolve, reject) => {
      // A sheet is already open for another action — reject the new request
      // instead of overwriting resolverRef, which would silently orphan the
      // first caller's promise (it would never resolve or reject).
      if (resolverRef.current) {
        reject(new Error('busy'));
        return;
      }
      resolverRef.current = { resolve, reject };
      dispatch({ type: 'reset' });
      setAction(a);
    });
  }, []);

  const close = useCallback((reason: string) => {
    resolverRef.current?.reject(new Error(reason));
    resolverRef.current = null;
    setAction(null);
    dispatch({ type: 'reset' });
  }, []);

  const submit = useCallback(async (currentAction: PendingAction, pin: string) => {
    dispatch({ type: 'submitStart' });
    try {
      const result = await execute({ id: currentAction.id, pin }).unwrap();
      markActionDone(currentAction.id);
      resolverRef.current?.resolve(result);
      resolverRef.current = null;
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

  return (
    <PinSheetContext.Provider value={{ openPinSheet }}>
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

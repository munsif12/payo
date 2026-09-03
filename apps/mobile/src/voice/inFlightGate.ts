// Pure "only one in flight" gate, split out of useConverse.ts so it's
// jest-testable standalone — useConverse.ts pulls in expo-audio, a native
// module jest-expo can't construct outside a real app render (see
// homeGreetingLogic.ts for the same pattern).
//
// useConverse.run() used to guard on the React `status` state, which lags a
// render behind — two fast taps (a double-tapped SuggestionCard, Enter-key
// repeat in the Composer) could both read the pre-update `status` and fire
// two /converse calls. A plain ref checked *before* any setState closes that
// window because it updates synchronously, unlike state.
export function createInFlightGate() {
  let inFlight = false;
  return {
    /** Returns true and marks the gate occupied, or false if already occupied. */
    tryEnter: (): boolean => {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release: (): void => {
      inFlight = false;
    },
  };
}

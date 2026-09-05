import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from '../api/types';
import { AUTH_STORAGE_KEY, NAME_CACHE_STORAGE_KEY } from './storageKeys';

export interface AuthState {
  token: string | null;
  user: PublicUser | null;
  hydrated: boolean;
  /** Short-lived otp-scope token from POST /auth/verify-otp — proves OTP verification only,
   *  accepted by set-pin/verify-pin. Never persisted (10-min server expiry; a fresh app
   *  launch always re-starts the phone flow instead of resuming a stale one). */
  otpToken: string | null;
  /** The phone number currently mid-verification (phone → otp → create/enter-pin). */
  pendingPhone: string | null;
  /** From verify-otp's `isNewUser` (= !pinSet) — routes to create-pin vs enter-pin. */
  isNewUser: boolean;
  /** Best-effort first-name for the Enter PIN greeting, resolved from the on-device name
   *  cache (see cacheUserName/getCachedName below) since verify-otp does not return the
   *  user's name — the app has no user record to read from until AFTER the PIN is checked. */
  pendingName: string | null;
}

const initialState: AuthState = {
  token: null, user: null, hydrated: false,
  otpToken: null, pendingPhone: null, isNewUser: false, pendingName: null,
};

const KEY = AUTH_STORAGE_KEY;
const NAME_CACHE_KEY = NAME_CACHE_STORAGE_KEY;

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ token: string; user: PublicUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.hydrated = true;
      state.otpToken = null;
      state.pendingPhone = null;
      state.isNewUser = false;
      state.pendingName = null;
      AsyncStorage.setItem(KEY, JSON.stringify(action.payload)).catch(() => {});
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      state.hydrated = true;
      state.otpToken = null;
      state.pendingPhone = null;
      state.isNewUser = false;
      state.pendingName = null;
      AsyncStorage.removeItem(KEY).catch(() => {});
    },
    hydrated(state, action: PayloadAction<{ token: string; user: PublicUser } | null>) {
      if (action.payload) {
        state.token = action.payload.token;
        state.user = action.payload.user;
      }
      state.hydrated = true;
    },
    /** Phone screen: request-otp succeeded — remember the phone for the OTP/PIN steps. */
    otpRequested(state, action: PayloadAction<{ phone: string }>) {
      state.pendingPhone = action.payload.phone;
    },
    /** OTP screen: verify-otp succeeded — otpToken unlocks set-pin/verify-pin. */
    otpVerified(state, action: PayloadAction<{ otpToken: string; isNewUser: boolean }>) {
      state.otpToken = action.payload.otpToken;
      state.isNewUser = action.payload.isNewUser;
    },
    pendingNameLoaded(state, action: PayloadAction<string | null>) {
      state.pendingName = action.payload;
    },
    /** "Not you?" / "Forgot PIN?" — drop the in-flight verification and go back to phone. */
    pendingCleared(state) {
      state.otpToken = null;
      state.pendingPhone = null;
      state.isNewUser = false;
      state.pendingName = null;
    },
  },
});

export const { signedIn, signedOut, hydrated, otpRequested, otpVerified, pendingNameLoaded, pendingCleared } = authSlice.actions;

export async function loadStoredAuth(): Promise<{ token: string; user: PublicUser } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** On-device, non-sensitive phone→name cache used ONLY to personalize the Enter PIN
 *  greeting ("Welcome back, {name}") for a phone that has signed in on this device
 *  before. Deliberately survives sign-out (it holds no secrets and enables the greeting
 *  the next time this device's owner re-enters their PIN); it is separate from the
 *  session store above, which IS cleared on sign-out. */
export async function cacheUserName(phone: string, name: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NAME_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[phone] = name;
    await AsyncStorage.setItem(NAME_CACHE_KEY, JSON.stringify(map));
  } catch { /* best-effort */ }
}

export async function getCachedName(phone: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(NAME_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[phone] ?? null;
  } catch { return null; }
}

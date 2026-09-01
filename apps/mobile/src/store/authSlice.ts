import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from '../api/types';

export interface AuthState { token: string | null; user: PublicUser | null; hydrated: boolean }

const initialState: AuthState = { token: null, user: null, hydrated: false };

const KEY = 'payo.auth';

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ token: string; user: PublicUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.hydrated = true;
      AsyncStorage.setItem(KEY, JSON.stringify(action.payload)).catch(() => {});
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      state.hydrated = true;
      AsyncStorage.removeItem(KEY).catch(() => {});
    },
    hydrated(state, action: PayloadAction<{ token: string; user: PublicUser } | null>) {
      if (action.payload) {
        state.token = action.payload.token;
        state.user = action.payload.user;
      }
      state.hydrated = true;
    },
  },
});

export const { signedIn, signedOut, hydrated } = authSlice.actions;

export async function loadStoredAuth(): Promise<{ token: string; user: PublicUser } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

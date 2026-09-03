import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { payoApi } from '../api/client';
import { authSlice } from './authSlice';

// Every RTK Query response is cached by endpoint name (no per-user cache key),
// so switching accounts within the same app session — log out, log in as a
// different user — would otherwise keep serving the previous user's cached
// /me, /bills/due, etc. Reset the whole API cache on both transitions so the
// new session always refetches under the new auth token.
const authCacheListener = createListenerMiddleware();
authCacheListener.startListening({
  matcher: (action) =>
    authSlice.actions.signedIn.match(action) || authSlice.actions.signedOut.match(action),
  effect: (_action, api) => {
    api.dispatch(payoApi.util.resetApiState());
  },
});

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    [payoApi.reducerPath]: payoApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().prepend(authCacheListener.middleware).concat(payoApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

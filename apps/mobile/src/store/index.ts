import { configureStore } from '@reduxjs/toolkit';
import { payoApi } from '../api/client';
import { authSlice } from './authSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    [payoApi.reducerPath]: payoApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(payoApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '@/managers/apiManager';
import uiReducer from '@/managers/uiSlice';
import authReducer from '@/managers/authSlice';
// Side-effect import: registers /auth/* endpoints onto the shared baseApi
// before any component tries to call useLoginMutation/useMeQuery.
import '@/managers/authApi';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      thunk: true,
    }).concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

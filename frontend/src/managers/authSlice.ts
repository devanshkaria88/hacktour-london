import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  status: 'unknown' | 'authenticated' | 'guest';
}

const initialState: AuthState = {
  user: null,
  status: 'unknown',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.status = 'authenticated';
    },
    clearUser: (state) => {
      state.user = null;
      state.status = 'guest';
    },
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;

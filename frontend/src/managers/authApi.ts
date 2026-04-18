import { baseApi } from './baseApi';
import type { AuthUser } from './authSlice';

interface AuthResponse {
  user: AuthUser;
}

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Auth endpoints layered onto the shared base RTK Query API.
 *
 * Kept as a hand-written slice (rather than going through the OpenAPI codegen)
 * so the cache wiring is explicit and login/signup invalidate every per-user
 * tag — guaranteeing the trajectory/baseline panels always refetch under the
 * new user's identity.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    signup: build.mutation<AuthResponse, SignupRequest>({
      query: (body) => ({
        url: '/api/v1/auth/signup',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Trajectory', 'Baseline', 'TriageEvents', 'Checkin', 'Me'],
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: '/api/v1/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Trajectory', 'Baseline', 'TriageEvents', 'Checkin', 'Me'],
    }),
    logout: build.mutation<void, void>({
      query: () => ({
        url: '/api/v1/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Trajectory', 'Baseline', 'TriageEvents', 'Checkin', 'Me'],
    }),
    me: build.query<AuthUser, void>({
      query: () => ({ url: '/api/v1/auth/me' }),
      providesTags: ['Me'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useSignupMutation,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
} = authApi;

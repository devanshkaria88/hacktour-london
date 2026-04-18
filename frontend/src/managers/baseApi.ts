import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:3001';

export const baseApi = createApi({
  reducerPath: 'api',
  // `credentials: 'include'` so the httpOnly session cookie set by /auth/login
  // travels on every subsequent request. The backend's CORS config already has
  // `credentials: true` for http://localhost:3000.
  baseQuery: fetchBaseQuery({ baseUrl, credentials: 'include' }),
  tagTypes: ['Trajectory', 'Baseline', 'TriageEvents', 'Checkin', 'Me'],
  endpoints: () => ({}),
});

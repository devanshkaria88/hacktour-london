'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useMeQuery } from '@/managers/authApi';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { clearUser, setUser } from '@/managers/authSlice';

/**
 * Wraps any page that requires a signed-in user.
 *
 *  * On mount, fetches `/auth/me` (cookie-authenticated).
 *  * If the call succeeds → hydrates the auth slice and renders children.
 *  * If it 401s → clears the slice and redirects to /login (with `next=` so
 *    we can bounce back after login).
 *  * While the call is in flight (and we have no cached user yet) → shows a
 *    soft loading splash so we never flash protected UI to a guest.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);
  const { data, error, isLoading, isFetching } = useMeQuery();

  useEffect(() => {
    if (data) {
      dispatch(setUser(data));
    }
  }, [data, dispatch]);

  useEffect(() => {
    if (error && 'status' in error && error.status === 401) {
      dispatch(clearUser());
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
    }
  }, [error, dispatch, router, pathname]);

  if (status === 'authenticated' && user) {
    return <>{children}</>;
  }

  if ((isLoading || isFetching) && status === 'unknown') {
    return (
      <div className="grid min-h-[60vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return null;
}

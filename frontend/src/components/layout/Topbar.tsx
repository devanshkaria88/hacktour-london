'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { clearUser } from '@/managers/authSlice';
import { useLogoutMutation } from '@/managers/authApi';
import { Button } from '@/components/ui/button';

export function Topbar() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [logout, { isLoading }] = useLogoutMutation();

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // even if the network call fails, drop the local session — the cookie
      // expires server-side and the next protected call will 401 anyway.
    }
    dispatch(clearUser());
    toast.success('Signed out.');
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 cursor-pointer"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
            <Activity className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="font-serif text-[15px] font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {user && (
            <>
              <span className="hidden sm:inline">Signed in as</span>
              <span
                className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-foreground/80"
                title={user.email}
              >
                {user.displayName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onLogout}
                disabled={isLoading}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

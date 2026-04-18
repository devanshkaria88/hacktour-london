'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLoginMutation } from '@/managers/authApi';
import { useAppDispatch } from '@/store/store';
import { setUser } from '@/managers/authSlice';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { user } = await login({ email, password }).unwrap();
      dispatch(setUser(user));
      toast.success(`Welcome back, ${user.displayName}.`);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : '/trajectory');
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-3xl text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to pick up your trajectory.
        </p>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="px-6 py-7">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link
          href={`/signup${params.get('next') ? `?next=${params.get('next')}` : ''}`}
          className="cursor-pointer text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function authErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { message?: string | string[] } }).data;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
  }
  return 'Sign-in failed. Check your email and password and try again.';
}

import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.95_0.04_220/0.55),transparent_70%)]"
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
            <span className="block h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-serif text-[15px] font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        {children}
      </main>

      <footer className="mx-auto pb-6 text-center text-xs text-muted-foreground">
        A research prototype, not a diagnostic tool.
      </footer>
    </div>
  );
}

import { Topbar } from '@/components/layout/Topbar';
import { AuthGate } from '@/components/auth/AuthGate';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col">
        <Topbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
          Olando is a research prototype. It is not a clinical decision tool.
        </footer>
      </div>
    </AuthGate>
  );
}

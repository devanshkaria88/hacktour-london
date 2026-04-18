import Link from 'next/link';
import { ArrowRight, FileText, LineChart, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      {/* soft ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.95_0.04_220/0.55),transparent_70%)]"
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
            <span className="block h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-serif text-[15px] font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/login"
            className="cursor-pointer hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="cursor-pointer rounded-full border border-border/80 bg-card px-3 py-1 text-foreground hover:bg-card/80 transition-colors"
          >
            Create account
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-10 text-center">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-status-stable" />
          Built for the eighteen-month NHS waiting list
        </span>

        <h1 className="font-serif text-balance text-[44px] leading-[1.05] tracking-tight text-foreground sm:text-[64px]">
          A second voice while you wait
          <br className="hidden sm:inline" />
          <span className="text-primary"> to be heard.</span>
        </h1>

        <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Sixty seconds a day. {APP_NAME} listens to how you sound, builds a
          private picture of your normal, and gives you a one-page packet for
          your GP if anything starts to drift.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="cursor-pointer h-12 px-7 text-[15px] font-medium"
          >
            <Link href="/signup">
              Get started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="cursor-pointer h-12 px-5 text-[15px] text-muted-foreground hover:text-foreground"
          >
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 sm:grid-cols-3">
          <HowStep
            icon={<Mic className="h-4 w-4" />}
            step="01"
            title="Speak"
            body="Answer one short prompt for sixty seconds. No typing. No survey. Just talking."
          />
          <HowStep
            icon={<LineChart className="h-4 w-4" />}
            step="02"
            title="Track"
            body="We measure twenty voice biomarkers tied to PHQ-9 and GAD-7, and chart you against yourself."
          />
          <HowStep
            icon={<FileText className="h-4 w-4" />}
            step="03"
            title="Triage"
            body="If your trajectory drifts, we generate a one-page packet you can hand to your GP."
          />
        </div>

        <p className="mt-10 max-w-md text-xs leading-relaxed text-muted-foreground">
          A research prototype, not a diagnostic tool. {APP_NAME} does not
          replace clinical care &mdash; it makes the wait visible.
        </p>
      </section>
    </div>
  );
}

function HowStep({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-card p-6 text-left">
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </span>
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
          {step}
        </span>
      </div>
      <h3 className="mt-4 font-serif text-lg text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Each step represents a stage in the post-call pipeline. The timings are
 * estimates derived from real runs against the local stack:
 *
 *   1. Capture (~instant — agent already has the PCM in memory)
 *   2. Transcribe (Speechmatics batch — typically 3-6s for a 60-120s clip)
 *   3. Biomarkers (Thymia Sentinel — 2-5s once the transcript triggers it)
 *   4. Persist  (~instant — single SQL insert)
 *
 * We don't know the *real* per-step duration without instrumenting the
 * agent, so we model the stages with weighted budgets that progress
 * smoothly inside the overall finalisation window.
 */
export type FinalisingStepKey =
  | 'capture'
  | 'transcribe'
  | 'biomarkers'
  | 'persist';

export type StepStatus = 'pending' | 'active' | 'done';

type StepDef = {
  key: FinalisingStepKey;
  label: string;
  hint: string;
  /** Cumulative fraction of the total budget this step has reached when done. */
  endFraction: number;
};

const STEPS: StepDef[] = [
  {
    key: 'capture',
    label: 'Capturing audio',
    hint: 'Stitching your microphone stream into a clean WAV.',
    endFraction: 0.05,
  },
  {
    key: 'transcribe',
    label: 'Transcribing speech',
    hint: 'Speechmatics medical model is reading what you said.',
    endFraction: 0.5,
  },
  {
    key: 'biomarkers',
    label: 'Reading vocal biomarkers',
    hint: 'Thymia Sentinel is scoring tone, energy, and prosody.',
    endFraction: 0.92,
  },
  {
    key: 'persist',
    label: 'Updating your trajectory',
    hint: 'Writing today’s point and recomputing divergence.',
    endFraction: 1,
  },
];

type Props = {
  /** Total budget in milliseconds, used for the visual countdown. */
  totalMs: number;
  /** Set to true once the new check-in is confirmed in the backend. */
  completed?: boolean;
};

export function FinalisingProgress({ totalMs, completed = false }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      setElapsedMs(performance.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Progress is bounded by the total budget. Once we hit ~95% we hold at
  // 95% and wait for the real backend confirmation rather than misleadingly
  // showing "100%" when we don't actually know if the check-in has landed.
  const progressFraction = useMemo(() => {
    if (completed) return 1;
    const raw = Math.min(elapsedMs / totalMs, 0.95);
    return raw;
  }, [completed, elapsedMs, totalMs]);

  const remainingSec = useMemo(() => {
    if (completed) return 0;
    const remainMs = Math.max(totalMs - elapsedMs, 0);
    return Math.ceil(remainMs / 1000);
  }, [completed, elapsedMs, totalMs]);

  const activeIndex = useMemo(() => {
    if (completed) return STEPS.length;
    for (let i = 0; i < STEPS.length; i++) {
      if (progressFraction < STEPS[i].endFraction) return i;
    }
    // We've consumed the full visual budget but haven't been told we're done
    // yet — keep the last step "active" rather than marking it complete, so
    // the user understands we're still waiting on the backend.
    return STEPS.length - 1;
  }, [completed, progressFraction]);

  return (
    <div className="flex w-full flex-col items-center gap-8 py-2">
      <CountdownRing
        progress={progressFraction}
        remainingSec={remainingSec}
        completed={completed}
      />

      <div className="text-center">
        <p className="font-serif text-lg text-foreground">
          {completed ? 'Check-in saved' : 'Saving your check-in'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {completed
            ? 'Routing you to your trajectory…'
            : 'Each stage runs on your private backend — nothing leaves the box.'}
        </p>
      </div>

      <ol className="w-full max-w-md space-y-2">
        {STEPS.map((step, index) => {
          const status: StepStatus =
            index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
          return <StepRow key={step.key} step={step} status={status} />;
        })}
      </ol>
    </div>
  );
}

function CountdownRing({
  progress,
  remainingSec,
  completed,
}: {
  progress: number;
  remainingSec: number;
  completed: boolean;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-border/60"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        {completed ? (
          <Check className="h-7 w-7 text-primary" strokeWidth={2.5} />
        ) : (
          <>
            <span className="font-serif text-2xl tabular-nums text-foreground">
              {remainingSec}s
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              estimated
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function StepRow({ step, status }: { step: StepDef; status: StepStatus }) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md border border-transparent px-3 py-2 transition-colors',
        status === 'active' && 'border-border/70 bg-card shadow-sm',
        status === 'done' && 'opacity-70',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full border text-[10px]',
          status === 'pending' &&
            'border-border/60 bg-background text-muted-foreground',
          status === 'active' &&
            'border-primary/60 bg-primary/10 text-primary',
          status === 'done' &&
            'border-primary bg-primary text-primary-foreground',
        )}
        aria-label={status}
      >
        {status === 'done' ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : status === 'active' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : null}
      </span>
      <div className="flex-1">
        <p
          className={cn(
            'text-sm leading-tight',
            status === 'active'
              ? 'text-foreground'
              : status === 'done'
                ? 'text-foreground/80'
                : 'text-muted-foreground',
          )}
        >
          {step.label}
        </p>
        {status === 'active' && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-0.5 text-xs text-muted-foreground"
          >
            {step.hint}
          </motion.p>
        )}
      </div>
    </li>
  );
}

'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Hourglass, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  BaselineResponseDto,
  TriageEventDto,
} from '@/managers/apiManager';

type Tone = 'neutral' | 'stable' | 'trending' | 'divergence';

interface StatusPanelProps {
  baseline: BaselineResponseDto | undefined;
  activeEvent: TriageEventDto | null;
}

export function StatusPanel({ baseline, activeEvent }: StatusPanelProps) {
  const tone: Tone = activeEvent
    ? 'divergence'
    : baseline?.isEstablished
      ? 'stable'
      : 'neutral';

  const toneClasses: Record<Tone, string> = {
    neutral: 'border-border bg-card',
    stable: 'border-status-stable/30 bg-status-stable-soft',
    trending: 'border-status-trending/40 bg-status-trending-soft',
    divergence: 'border-status-divergence/40 bg-status-divergence-soft',
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className={cn(
        'rounded-2xl border p-6 transition-colors',
        toneClasses[tone],
      )}
    >
      {tone === 'neutral' && (
        <NeutralBody
          checkinCount={baseline?.checkinCount ?? 0}
        />
      )}
      {tone === 'stable' && <StableBody baseline={baseline!} />}
      {tone === 'divergence' && activeEvent && (
        <DivergenceBody event={activeEvent} />
      )}
    </motion.section>
  );
}

function NeutralBody({ checkinCount }: { checkinCount: number }) {
  const remaining = Math.max(0, 7 - checkinCount);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted-foreground/10 text-muted-foreground">
          <Hourglass className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-serif text-lg text-foreground">
            Building your baseline
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Check in daily so we can learn what your normal sounds like.
            {remaining > 0 ? (
              <>
                {' '}
                <span className="font-medium text-foreground">
                  {remaining} more {remaining === 1 ? 'day' : 'days'}
                </span>{' '}
                until divergence detection turns on.
              </>
            ) : (
              ' Your baseline is being calculated now.'
            )}
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="cursor-pointer">
        <Link href="/record">Record today&apos;s check-in</Link>
      </Button>
    </div>
  );
}

function StableBody({ baseline }: { baseline: BaselineResponseDto }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-status-stable/15 text-status-stable">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-serif text-lg text-foreground">
            Your trajectory is stable
          </h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your seven-day rolling average sits within your personal baseline
            range. We&apos;ll let you know if anything starts to drift.
          </p>
          <BaselineMeta baseline={baseline} />
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="cursor-pointer">
        <Link href="/record">Record today&apos;s check-in</Link>
      </Button>
    </div>
  );
}

function DivergenceBody({ event }: { event: TriageEventDto }) {
  const compositeLabel = event.composite === 'phq9' ? 'PHQ-9 (depression)' : 'GAD-7 (anxiety)';
  const sigmas =
    event.baselineStddev > 0
      ? (event.observedValue - event.baselineMean) / event.baselineStddev
      : 0;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-status-divergence/15 text-status-divergence">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="space-y-2.5">
          <h3 className="font-serif text-lg text-foreground">
            Divergence detected on {compositeLabel}
          </h3>
          <p className="max-w-md text-sm leading-relaxed text-foreground/80">
            {event.triggerReason}
          </p>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-1 pt-2 text-xs">
            <Stat label="Observed" value={event.observedValue.toFixed(3)} />
            <Stat label="Baseline" value={event.baselineMean.toFixed(3)} />
            <Stat
              label="Above baseline"
              value={`${sigmas >= 0 ? '+' : ''}${sigmas.toFixed(2)} σ`}
              accent
            />
          </dl>
        </div>
      </div>
      <Button asChild size="sm" className="cursor-pointer bg-foreground text-background hover:bg-foreground/90">
        <Link href={`/triage/${event.id}`}>
          Open triage packet
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'font-mono tabular-nums text-sm',
          accent ? 'text-status-divergence font-semibold' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function BaselineMeta({ baseline }: { baseline: BaselineResponseDto }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {baseline.phq9 && (
        <Stat
          label="PHQ-9 baseline"
          value={`${baseline.phq9.mean.toFixed(3)} ± ${baseline.phq9.stddev.toFixed(3)}`}
        />
      )}
      {baseline.gad7 && (
        <Stat
          label="GAD-7 baseline"
          value={`${baseline.gad7.mean.toFixed(3)} ± ${baseline.gad7.stddev.toFixed(3)}`}
        />
      )}
    </dl>
  );
}

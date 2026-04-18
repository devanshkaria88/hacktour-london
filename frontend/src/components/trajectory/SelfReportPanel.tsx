'use client';

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Brain, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useGetQuestionnaireLatestQuery,
  type InstrumentSummaryDto,
} from '@/managers/apiManager';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the user's latest PHQ-9 and GAD-7 totals, scored exactly the way
 * the published instruments specify: SUM of item responses (0-3 each) over
 * the last fortnight, with severity bands suppressed when coverage is below
 * the standard 80% validity threshold.
 *
 * NB: PHQ-9 here is effectively the PHQ-8 (Kroenke 2009) — item 9 is covered
 * by the agent's safety prompt rather than asked directly. Both share the
 * same severity bands so the number is directly comparable to PHQ-9.
 */
export function SelfReportPanel() {
  const { data, isLoading, error } = useGetQuestionnaireLatestQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  if (isLoading) return <SelfReportSkeleton />;
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Couldn&apos;t load your self-report scores right now.
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl border border-border/70 bg-card/70 shadow-sm"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Self-report · last 14 days
          </p>
          <h2 className="mt-1 font-serif text-lg text-foreground">
            What you&apos;ve told us
          </h2>
        </div>
        <ScoringFootnote />
      </header>
      <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-2">
        <InstrumentCard
          summary={data.phq9}
          publishedTitle="PHQ-9"
          publishedSubtitle="Depression"
          icon={<Brain className="h-4 w-4" />}
          accent="oklch(0.55 0.18 250)"
        />
        <InstrumentCard
          summary={data.gad7}
          publishedTitle="GAD-7"
          publishedSubtitle="Generalised anxiety"
          icon={<Activity className="h-4 w-4" />}
          accent="oklch(0.6 0.18 305)"
        />
      </div>
    </motion.section>
  );
}

interface InstrumentCardProps {
  summary: InstrumentSummaryDto;
  publishedTitle: string;
  publishedSubtitle: string;
  icon: React.ReactNode;
  accent: string;
}

function InstrumentCard({
  summary,
  publishedTitle,
  publishedSubtitle,
  icon,
  accent,
}: InstrumentCardProps) {
  const {
    total,
    maxScore,
    severity,
    itemsAnswered,
    itemsTotal,
    itemsPublished,
    coverageValid,
    lastAnsweredAt,
  } = summary;

  const hasAnyAnswers = itemsAnswered > 0;
  const coveragePct = itemsTotal === 0 ? 0 : itemsAnswered / itemsTotal;
  const scorePct = total != null && maxScore > 0 ? total / maxScore : 0;

  return (
    <div className="bg-card px-6 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-md"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              {icon}
            </span>
            <div>
              <p className="font-serif text-base text-foreground">
                {publishedTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {publishedSubtitle}
              </p>
            </div>
          </div>
        </div>
        <SeverityPill severity={severity} coverageValid={coverageValid} />
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span
          className="font-serif text-4xl tabular-nums leading-none"
          style={{ color: hasAnyAnswers ? accent : 'var(--color-muted-foreground)' }}
        >
          {total != null ? total : '—'}
        </span>
        <span className="text-sm text-muted-foreground">/ {maxScore}</span>
      </div>

      <ScoreMeter value={scorePct} accent={accent} severity={severity} />

      <div className="mt-4 space-y-2">
        <CoverageBar
          itemsAnswered={itemsAnswered}
          itemsTotal={itemsTotal}
          itemsPublished={itemsPublished}
          coverageValid={coverageValid}
          accent={accent}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {hasAnyAnswers && lastAnsweredAt ? (
            <>
              Last item answered{' '}
              <span className="text-foreground">
                {formatDistanceToNow(new Date(lastAnsweredAt), {
                  addSuffix: true,
                })}
              </span>
              .{' '}
              {coverageValid ? (
                <>
                  Coverage is above the 80% validity threshold the original PHQ-9
                  manual specifies — the severity band is reliable.
                </>
              ) : (
                <>
                  Coverage is below 80% so we&apos;re showing the score but
                  hiding the severity band — exactly as the standard scoring
                  rules require.
                </>
              )}
            </>
          ) : (
            <>
              No items answered yet. Each conversational check-in weaves in a
              few PHQ-9 / GAD-7 items, and the rolling total builds from
              there. {publishedTitle === 'PHQ-9' ? 'Item 9 (self-harm) is covered by the safety prompt rather than asked.' : ''}
            </>
          )}
        </p>
      </div>

      {Math.abs(coveragePct) < 0.001 && coverageBandHint(scorePct, severity)}
    </div>
  );
}

function ScoreMeter({
  value,
  accent,
  severity,
}: {
  value: number;
  accent: string;
  severity: InstrumentSummaryDto['severity'];
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: severity ? accent : 'var(--color-muted-foreground)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 110, damping: 18 }}
        />
      </div>
    </div>
  );
}

function coverageBandHint(
  scorePct: number,
  severity: InstrumentSummaryDto['severity'],
) {
  if (severity || scorePct === 0) return null;
  return null;
}

const SEVERITY_LABEL: Record<
  Exclude<InstrumentSummaryDto['severity'], null>,
  { label: string; tone: string }
> = {
  minimal: {
    label: 'Minimal',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  },
  mild: {
    label: 'Mild',
    tone: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
  },
  moderate: {
    label: 'Moderate',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  },
  moderately_severe: {
    label: 'Moderately severe',
    tone: 'border-orange-500/40 bg-orange-500/15 text-orange-700',
  },
  severe: {
    label: 'Severe',
    tone: 'border-rose-500/40 bg-rose-500/15 text-rose-700',
  },
};

function SeverityPill({
  severity,
  coverageValid,
}: {
  severity: InstrumentSummaryDto['severity'];
  coverageValid: boolean;
}) {
  if (!severity) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {coverageValid ? '—' : 'Building coverage'}
      </span>
    );
  }
  const meta = SEVERITY_LABEL[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
        meta.tone,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function CoverageBar({
  itemsAnswered,
  itemsTotal,
  itemsPublished,
  coverageValid,
  accent,
}: {
  itemsAnswered: number;
  itemsTotal: number;
  itemsPublished: number;
  coverageValid: boolean;
  accent: string;
}) {
  const pct = itemsTotal === 0 ? 0 : Math.min(1, itemsAnswered / itemsTotal);
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        <span>Coverage</span>
        <span>
          {itemsAnswered} / {itemsTotal} asked
          {itemsTotal !== itemsPublished && (
            <span className="text-muted-foreground/60">
              {' '}
              · {itemsPublished} published
            </span>
          )}
        </span>
      </div>
      <div className="mt-1 relative h-1 w-full overflow-hidden rounded-full bg-muted/60">
        <motion.span
          aria-hidden
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundColor: coverageValid ? accent : 'var(--color-muted-foreground)',
            opacity: coverageValid ? 0.8 : 0.4,
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 border-l border-dashed border-foreground/40"
          style={{ left: '80%' }}
          title="Validity threshold (80%)"
        />
      </div>
    </div>
  );
}

function ScoringFootnote() {
  return (
    <details className="group/info text-[11px] text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 select-none hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
        How is this scored?
      </summary>
      <div className="mt-2 max-w-xs space-y-2 rounded-md border border-border/60 bg-popover px-3 py-2 text-left leading-relaxed shadow-md">
        <p>
          Standard PHQ-9 / GAD-7 scoring: each item is rated 0-3, and the total
          is the SUM of the items asked over the last 14 days.
        </p>
        <p>
          PHQ-9 here is effectively the PHQ-8 (Kroenke 2009) — item 9 (self
          harm) is covered by the agent&apos;s safety prompt rather than asked,
          so the maximum is 24 instead of 27. Both share identical severity
          bands.
        </p>
        <p className="text-foreground">
          ≥10 = clinically significant cut-point on both screens.
        </p>
      </div>
    </details>
  );
}

function SelfReportSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TrajectoryPointDto } from '@/managers/apiManager';

export type BiomarkerKey =
  | 'anhedonia'
  | 'lowMood'
  | 'sleepIssues'
  | 'lowEnergy'
  | 'appetite'
  | 'worthlessness'
  | 'concentration'
  | 'psychomotor'
  | 'nervousness'
  | 'uncontrollableWorry'
  | 'excessiveWorry'
  | 'troubleRelaxing'
  | 'restlessness'
  | 'irritability'
  | 'dread'
  | 'distress'
  | 'stress'
  | 'burnout'
  | 'fatigue'
  | 'lowSelfEsteem';

interface SparklineProps {
  label: string;
  description: string;
  metricKey: BiomarkerKey;
  points: TrajectoryPointDto[];
  /**
   * Literal OKLCH colour used for the line, gradient fill, and value text.
   * Hand-picked per dimension so each card is visually distinct.
   */
  color: string;
  /**
   * If true, higher = better (wellness framing). Affects only the colour of
   * the delta arrow.
   */
  invertSentiment?: boolean;
}

interface SparkPoint {
  recordedAt: string;
  value: number | null;
  date: string;
}

/**
 * Map a 0-1 reading to a clinical-feeling severity bucket. The thresholds
 * are intentionally aligned with how the Apollo composites bucket.
 */
function severityOf(value: number): {
  label: string;
  tone: 'low' | 'moderate' | 'elevated' | 'high';
} {
  if (value < 0.3) return { label: 'Low', tone: 'low' };
  if (value < 0.5) return { label: 'Moderate', tone: 'moderate' };
  if (value < 0.7) return { label: 'Elevated', tone: 'elevated' };
  return { label: 'High', tone: 'high' };
}

const TONE_PILL: Record<string, string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  moderate: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
  elevated: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
};

export function BiomarkerSparkline({
  label,
  description,
  metricKey,
  points,
  color,
  invertSentiment = false,
}: SparklineProps) {
  const data: SparkPoint[] = useMemo(
    () =>
      points.map((p) => ({
        recordedAt: p.recordedAt,
        value: p.biomarkers ? (p.biomarkers[metricKey] ?? null) : null,
        date: format(new Date(p.recordedAt), 'd MMM, HH:mm'),
      })),
    [points, metricKey],
  );

  const observations = data.filter((d) => d.value != null) as Array<
    SparkPoint & { value: number }
  >;
  const latest = observations[observations.length - 1]?.value ?? null;
  const previous = observations[observations.length - 2]?.value ?? null;
  const delta =
    latest != null && previous != null ? latest - previous : null;

  const deltaIsImproving =
    delta == null
      ? null
      : Math.abs(delta) < 0.005
        ? null
        : invertSentiment
          ? delta > 0
          : delta < 0;

  // Baseline = mean of all but the most recent reading. Useful as a
  // reference line on the sparkline so the latest value gets context.
  const baselineMean = useMemo(() => {
    const history = observations.slice(0, -1);
    if (history.length < 2) return null;
    return (
      history.reduce((acc, d) => acc + d.value, 0) / history.length
    );
  }, [observations]);

  const gradientId = useMemo(
    () => `sparkfill-${metricKey}-${Math.random().toString(36).slice(2, 7)}`,
    [metricKey],
  );

  const isEmpty = observations.length === 0;
  const hasTrend = observations.length >= 2;
  const severity = latest != null ? severityOf(latest) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group/spark relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="font-serif text-[15px] leading-tight text-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="font-mono text-2xl font-semibold tabular-nums leading-none"
            style={{ color: latest != null ? color : 'var(--color-muted-foreground)' }}
          >
            {latest != null ? latest.toFixed(2) : '—'}
          </span>
          {delta != null && (
            <span
              className={cn(
                'mt-1 font-mono text-[10px] tabular-nums',
                deltaIsImproving === true && 'text-emerald-600',
                deltaIsImproving === false && 'text-rose-600',
                deltaIsImproving === null && 'text-muted-foreground',
              )}
            >
              {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'}{' '}
              {Math.abs(delta).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Severity meter — always visible. With 1 reading this is the main
          visualisation; with many readings it sits below the sparkline as a
          permanent "where do I sit on 0-1 right now" gauge. */}
      <SeverityMeter value={latest} color={color} />

      <div className="flex items-center justify-between pl-2">
        {severity ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              TONE_PILL[severity.tone],
            )}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: 'currentColor' }}
            />
            {severity.label}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/70">
            No reading yet
          </span>
        )}
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {observations.length} reading{observations.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Trend strip — only when we have ≥2 readings, otherwise the meter
          alone carries the visual. */}
      {hasTrend && (
        <div className="relative -mx-1 mt-1 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 1]} />
              {baselineMean != null && (
                <ReferenceLine
                  y={baselineMean}
                  stroke="oklch(var(--muted-foreground) / 0.35)"
                  strokeDasharray="2 3"
                />
              )}
              <Tooltip
                content={<MiniTooltip metricLabel={label} color={color} />}
                cursor={{ stroke: color, strokeOpacity: 0.4, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive
                animationDuration={500}
                connectNulls
                dot={false}
                activeDot={{
                  r: 3,
                  stroke: 'oklch(var(--background))',
                  strokeWidth: 1.5,
                  fill: color,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!hasTrend && !isEmpty && (
        <p className="pl-2 text-[10px] leading-snug text-muted-foreground/70">
          Trend line appears after your next check-in.
        </p>
      )}
    </motion.div>
  );
}

/**
 * Horizontal 0-1 gauge with a coloured marker at the current value. Always
 * visible — even with one reading you immediately see where the dimension
 * sits on the severity scale.
 */
function SeverityMeter({
  value,
  color,
}: {
  value: number | null;
  color: string;
}) {
  const pct = value != null ? Math.max(0, Math.min(1, value)) * 100 : 0;
  return (
    <div className="pl-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-300">
        {value != null && (
          <motion.span
            initial={{ left: '0%' }}
            animate={{ left: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 130, damping: 18 }}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
        <span>0.0</span>
        <span>0.5</span>
        <span>1.0</span>
      </div>
    </div>
  );
}

function MiniTooltip({
  active,
  payload,
  metricLabel,
  color,
}: {
  active?: boolean;
  payload?: { value: number | null; payload?: SparkPoint }[];
  metricLabel: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  if (point.value == null) return null;
  return (
    <div className="rounded-md border border-border/80 bg-popover px-2.5 py-1.5 text-[11px] shadow-md">
      <p className="font-medium" style={{ color }}>
        {metricLabel}
      </p>
      <p className="text-muted-foreground">{point.payload?.date}</p>
      <p className="mt-0.5 font-mono tabular-nums text-foreground">
        {point.value.toFixed(3)}
      </p>
    </div>
  );
}

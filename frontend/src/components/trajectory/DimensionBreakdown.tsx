'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { BiomarkersDto } from '@/managers/apiManager';

interface Group {
  title: string;
  description: string;
  color: string;
  rows: { key: keyof BiomarkersDto; label: string }[];
}

const GROUPS: Group[] = [
  {
    title: 'Apollo · depression',
    description: 'PHQ-9 aligned facets',
    color: 'oklch(0.55 0.15 250)',
    rows: [
      { key: 'anhedonia', label: 'Anhedonia' },
      { key: 'lowMood', label: 'Low mood' },
      { key: 'sleepIssues', label: 'Sleep issues' },
      { key: 'lowEnergy', label: 'Low energy' },
      { key: 'appetite', label: 'Appetite' },
      { key: 'worthlessness', label: 'Worthlessness' },
      { key: 'concentration', label: 'Concentration' },
      { key: 'psychomotor', label: 'Psychomotor' },
    ],
  },
  {
    title: 'Apollo · anxiety',
    description: 'GAD-7 aligned facets',
    color: 'oklch(0.55 0.16 305)',
    rows: [
      { key: 'nervousness', label: 'Nervousness' },
      { key: 'uncontrollableWorry', label: 'Uncontrollable worry' },
      { key: 'excessiveWorry', label: 'Excessive worry' },
      { key: 'troubleRelaxing', label: 'Trouble relaxing' },
      { key: 'restlessness', label: 'Restlessness' },
      { key: 'irritability', label: 'Irritability' },
      { key: 'dread', label: 'Dread' },
    ],
  },
  {
    title: 'Helios · wellness',
    description: 'Broader wellness signals',
    color: 'oklch(0.62 0.16 30)',
    rows: [
      { key: 'distress', label: 'Distress' },
      { key: 'stress', label: 'Stress' },
      { key: 'burnout', label: 'Burnout' },
      { key: 'fatigue', label: 'Fatigue' },
      { key: 'lowSelfEsteem', label: 'Low self-esteem' },
    ],
  },
];

interface Props {
  biomarkers: BiomarkersDto | null;
  /** Optional comparison row (e.g. 7-day rolling baseline) for delta arrows. */
  comparison?: BiomarkersDto | null;
}

/**
 * Three-column breakdown of every biomarker for a single check-in. Each row
 * shows label, current value, optional delta vs the comparison point, and a
 * small bar for visual scanning.
 */
export function DimensionBreakdown({ biomarkers, comparison }: Props) {
  if (!biomarkers) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No biomarker reading was captured for this check-in.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {GROUPS.map((group, gi) => (
        <motion.div
          key={group.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: gi * 0.05 }}
          className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <p className="font-serif text-sm text-foreground">{group.title}</p>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {group.description}
          </p>
          <ul className="space-y-2.5">
            {group.rows.map((row) => {
              const value = biomarkers[row.key];
              const previous = comparison ? comparison[row.key] : null;
              const delta =
                value != null && previous != null ? value - previous : null;
              return (
                <Row
                  key={row.key as string}
                  label={row.label}
                  value={value}
                  delta={delta}
                  color={group.color}
                />
              );
            })}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  delta,
  color,
}: {
  label: string;
  value: number | null;
  delta: number | null;
  color: string;
}) {
  const pct = value != null ? Math.max(0, Math.min(1, value)) * 100 : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-foreground/80">{label}</span>
        <span className="flex items-center gap-1.5">
          {delta != null && Math.abs(delta) >= 0.005 && (
            <span
              className={cn(
                'font-mono tabular-nums text-[10px]',
                delta > 0 ? 'text-rose-600' : 'text-emerald-600',
              )}
            >
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}
            </span>
          )}
          <span
            className="font-mono text-[12px] tabular-nums font-semibold"
            style={{ color: value != null ? color : 'var(--color-muted-foreground)' }}
          >
            {value != null ? value.toFixed(2) : '—'}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </li>
  );
}

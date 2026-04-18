'use client';

import { motion } from 'framer-motion';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Dot,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { addDays, format, startOfDay } from 'date-fns';
import type {
  BaselineResponseDto,
  TrajectoryPointDto,
} from '@/managers/apiManager';

interface TrajectoryChartProps {
  points: TrajectoryPointDto[];
  baseline: BaselineResponseDto | undefined;
}

interface ChartPoint {
  recordedAt: string;
  date: string;
  short: string;
  phq9: number | null;
  gad7: number | null;
  triggered: boolean;
}

/**
 * Distinct, vibrant brand colours for the two composites. Hand-picked so they
 * read clearly side-by-side on a light background and don't blend with the
 * subtle severity bands behind them.
 */
const PHQ9_COLOR = 'oklch(0.55 0.18 250)'; // saturated blue
const GAD7_COLOR = 'oklch(0.6 0.18 305)'; // saturated violet

/**
 * When the user has zero check-ins we still want the chart canvas (axes +
 * gridlines + severity bands) to be visible so day 1 isn't an empty hole.
 */
function buildEmptyFrame(): ChartPoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return {
      recordedAt: d.toISOString(),
      date: format(d, 'd MMM'),
      short: format(d, 'd MMM'),
      phq9: null,
      gad7: null,
      triggered: false,
    };
  });
}

export function TrajectoryChart({ points, baseline }: TrajectoryChartProps) {
  const isEmpty = points.length === 0;
  const data: ChartPoint[] = isEmpty
    ? buildEmptyFrame()
    : points.map((p) => {
        const d = new Date(p.recordedAt);
        return {
          recordedAt: p.recordedAt,
          date: format(d, 'd MMM, HH:mm'),
          short: format(d, 'd MMM'),
          phq9: p.phq9Composite,
          gad7: p.gad7Composite,
          triggered: p.triggeredDivergence,
        };
      });

  const phq9Threshold =
    baseline?.phq9 != null
      ? baseline.phq9.mean + 2 * baseline.phq9.stddev
      : undefined;
  const gad7Threshold =
    baseline?.gad7 != null
      ? baseline.gad7.mean + 2 * baseline.gad7.stddev
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative h-[340px] w-full"
    >
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="max-w-[18rem] text-center text-sm leading-relaxed text-muted-foreground/70">
            Your first check-in will land here. After seven days, your personal
            baseline turns on.
          </p>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 16, left: -12, bottom: 4 }}
        >
          <defs>
            <linearGradient id="phq9-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PHQ9_COLOR} stopOpacity={0.32} />
              <stop offset="95%" stopColor={PHQ9_COLOR} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gad7-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GAD7_COLOR} stopOpacity={0.28} />
              <stop offset="95%" stopColor={GAD7_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Subtle severity bands behind the lines — gives the chart a sense
              of "where on the scale am I" without needing legends to read it. */}
          <ReferenceArea
            y1={0}
            y2={0.33}
            fill="oklch(0.7 0.15 145)"
            fillOpacity={0.05}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            y1={0.33}
            y2={0.66}
            fill="oklch(0.78 0.16 75)"
            fillOpacity={0.06}
            ifOverflow="extendDomain"
          />
          <ReferenceArea
            y1={0.66}
            y2={1}
            fill="oklch(0.65 0.2 25)"
            fillOpacity={0.07}
            ifOverflow="extendDomain"
          />

          <CartesianGrid
            strokeDasharray="2 4"
            stroke="oklch(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 11, fill: 'oklch(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'oklch(var(--border))' }}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v) => v.toFixed(2)}
            tick={{ fontSize: 11, fill: 'oklch(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'oklch(var(--border))', strokeWidth: 1 }}
          />

          {phq9Threshold !== undefined && (
            <ReferenceLine
              y={phq9Threshold}
              stroke={PHQ9_COLOR}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              ifOverflow="visible"
            />
          )}
          {gad7Threshold !== undefined && (
            <ReferenceLine
              y={gad7Threshold}
              stroke={GAD7_COLOR}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              ifOverflow="visible"
            />
          )}

          {/* Gradient-filled area underneath each line */}
          <Area
            type="monotone"
            dataKey="phq9"
            stroke="none"
            fill="url(#phq9-fill)"
            isAnimationActive
            animationDuration={650}
          />
          <Area
            type="monotone"
            dataKey="gad7"
            stroke="none"
            fill="url(#gad7-fill)"
            isAnimationActive
            animationDuration={650}
            animationBegin={120}
          />

          {/* Crisp lines on top of the fills */}
          <Line
            type="monotone"
            dataKey="phq9"
            name="PHQ-9"
            stroke={PHQ9_COLOR}
            strokeWidth={2.5}
            dot={(props) => <CustomDot {...props} color={PHQ9_COLOR} />}
            activeDot={{
              r: 5,
              stroke: 'oklch(var(--background))',
              strokeWidth: 2,
              fill: PHQ9_COLOR,
            }}
            isAnimationActive
            animationDuration={650}
          />
          <Line
            type="monotone"
            dataKey="gad7"
            name="GAD-7"
            stroke={GAD7_COLOR}
            strokeWidth={2.5}
            dot={(props) => <CustomDot {...props} color={GAD7_COLOR} />}
            activeDot={{
              r: 5,
              stroke: 'oklch(var(--background))',
              strokeWidth: 2,
              fill: GAD7_COLOR,
            }}
            isAnimationActive
            animationDuration={650}
            animationBegin={120}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground">
        <LegendDot color={PHQ9_COLOR} label="PHQ-9 (depression)" />
        <LegendDot color={GAD7_COLOR} label="GAD-7 (anxiety)" />
        <LegendDot
          color="oklch(var(--status-divergence))"
          label="Divergence event"
        />
        {(phq9Threshold !== undefined || gad7Threshold !== undefined) && (
          <span className="inline-flex items-center gap-2">
            <span className="h-px w-6 border-t border-dashed border-muted-foreground/60" />
            Personal threshold
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.14em]">
          <BandKey color="oklch(0.7 0.15 145)" label="Low" />
          <BandKey color="oklch(0.78 0.16 75)" label="Moderate" />
          <BandKey color="oklch(0.65 0.2 25)" label="Elevated" />
        </span>
      </div>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function BandKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
      <span
        className="h-2 w-3 rounded-sm"
        style={{ backgroundColor: color, opacity: 0.35 }}
      />
      {label}
    </span>
  );
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  color: string;
}

function CustomDot({ cx, cy, payload, color }: CustomDotProps) {
  if (cx == null || cy == null) return null;
  if (payload?.triggered) {
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={6}
        stroke="oklch(var(--background))"
        strokeWidth={2}
        fill="oklch(var(--status-divergence))"
      />
    );
  }
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      stroke="oklch(var(--background))"
      strokeWidth={1.5}
      fill={color}
    />
  );
}

interface TooltipPayloadItem {
  name?: string;
  dataKey?: string | number;
  value: number | null;
  payload?: ChartPoint;
  color?: string;
}

// Pretty labels per dataKey — keeps the tooltip readable when only the Area
// entry survives the dedupe and Recharts hands us back the raw key.
const DATAKEY_LABEL: Record<string, { label: string; color: string }> = {
  phq9: { label: 'PHQ-9', color: PHQ9_COLOR },
  gad7: { label: 'GAD-7', color: GAD7_COLOR },
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point) return null;
  // ComposedChart sends one entry per child series (Area AND Line for each
  // metric here). Dedupe by `dataKey` because that's stable across both —
  // unlike `name`, which Recharts only fills from the explicit prop on the
  // Line and falls back to the raw dataKey for the Area.
  const seen = new Set<string>();
  const visible = payload.filter((p) => {
    const key = p.dataKey != null ? String(p.dataKey) : '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const hasAnyValue = visible.some((p) => p.value != null);
  if (!hasAnyValue) return null;
  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.date}</p>
      <div className="mt-1 space-y-0.5">
        {visible.map((p) => {
          const key = String(p.dataKey ?? p.name ?? '');
          const meta = DATAKEY_LABEL[key];
          const label = meta?.label ?? p.name ?? key;
          const swatch = meta?.color ?? p.color;
          return (
            <div
              key={key}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: swatch }}
              />
              <span className="font-medium text-foreground">{label}</span>
              <span className="font-mono tabular-nums">
                {p.value == null ? 'n/a' : p.value.toFixed(3)}
              </span>
            </div>
          );
        })}
        {point.triggered && (
          <p className="mt-1 text-status-divergence">Divergence triggered</p>
        )}
      </div>
    </div>
  );
}

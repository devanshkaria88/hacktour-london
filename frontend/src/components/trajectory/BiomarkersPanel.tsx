'use client';

import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrajectoryChart } from '@/components/trajectory/TrajectoryChart';
import {
  BiomarkerSparkline,
  type BiomarkerKey,
} from '@/components/trajectory/BiomarkerSparkline';
import type {
  BaselineResponseDto,
  TrajectoryPointDto,
} from '@/managers/apiManager';

interface PanelProps {
  points: TrajectoryPointDto[];
  baseline: BaselineResponseDto | undefined;
}

interface DimensionDef {
  key: BiomarkerKey;
  label: string;
  description: string;
  /**
   * Literal OKLCH colour for this dimension. Hand-picked palettes give each
   * tab a coherent visual family while keeping every card distinct from its
   * neighbours.
   */
  color: string;
  invertSentiment?: boolean;
}

/**
 * Apollo PHQ-9 dimensions. Cool blue/teal palette — calm, clinical.
 */
const DEPRESSION_DIMENSIONS: DimensionDef[] = [
  {
    key: 'anhedonia',
    label: 'Anhedonia',
    description: 'Reduced pleasure or interest in activities.',
    color: 'oklch(0.62 0.13 220)',
  },
  {
    key: 'lowMood',
    label: 'Low mood',
    description: 'Persistent sadness or hopelessness.',
    color: 'oklch(0.55 0.15 250)',
  },
  {
    key: 'sleepIssues',
    label: 'Sleep issues',
    description: 'Trouble falling, staying, or wanting to stay asleep.',
    color: 'oklch(0.58 0.13 200)',
  },
  {
    key: 'lowEnergy',
    label: 'Low energy',
    description: 'Fatigue or feeling worn out.',
    color: 'oklch(0.5 0.14 235)',
  },
  {
    key: 'appetite',
    label: 'Appetite',
    description: 'Notable change in appetite or weight.',
    color: 'oklch(0.66 0.11 195)',
  },
  {
    key: 'worthlessness',
    label: 'Worthlessness',
    description: 'Self-critical thoughts or guilt.',
    color: 'oklch(0.5 0.16 270)',
  },
  {
    key: 'concentration',
    label: 'Concentration',
    description: 'Difficulty focusing or making decisions.',
    color: 'oklch(0.6 0.12 215)',
  },
  {
    key: 'psychomotor',
    label: 'Psychomotor',
    description: 'Slowed or restless movement and speech.',
    color: 'oklch(0.55 0.13 185)',
  },
];

/**
 * Apollo GAD-7 dimensions. Violet/magenta palette — anxious activation.
 */
const ANXIETY_DIMENSIONS: DimensionDef[] = [
  {
    key: 'nervousness',
    label: 'Nervousness',
    description: 'Feeling on edge or tense.',
    color: 'oklch(0.6 0.14 290)',
  },
  {
    key: 'uncontrollableWorry',
    label: 'Uncontrollable worry',
    description: 'Worry that is hard to switch off.',
    color: 'oklch(0.55 0.16 305)',
  },
  {
    key: 'excessiveWorry',
    label: 'Excessive worry',
    description: 'Worrying too much across many topics.',
    color: 'oklch(0.62 0.13 280)',
  },
  {
    key: 'troubleRelaxing',
    label: 'Trouble relaxing',
    description: 'Difficulty unwinding or settling down.',
    color: 'oklch(0.52 0.15 320)',
  },
  {
    key: 'restlessness',
    label: 'Restlessness',
    description: 'Hard to sit still.',
    color: 'oklch(0.65 0.12 270)',
  },
  {
    key: 'irritability',
    label: 'Irritability',
    description: 'Easily annoyed or short-fused.',
    color: 'oklch(0.55 0.17 340)',
  },
  {
    key: 'dread',
    label: 'Dread',
    description: 'Sense that something bad might happen.',
    color: 'oklch(0.5 0.16 310)',
  },
];

/**
 * Helios wellness dimensions. Warm amber/coral/rose palette.
 */
const WELLNESS_DIMENSIONS: DimensionDef[] = [
  {
    key: 'distress',
    label: 'Distress',
    description: 'Overall psychological distress.',
    color: 'oklch(0.62 0.16 30)',
  },
  {
    key: 'stress',
    label: 'Stress',
    description: 'Acute load and pressure.',
    color: 'oklch(0.66 0.14 50)',
  },
  {
    key: 'burnout',
    label: 'Burnout',
    description: 'Chronic exhaustion and depletion.',
    color: 'oklch(0.58 0.17 20)',
  },
  {
    key: 'fatigue',
    label: 'Fatigue',
    description: 'Tiredness and lack of vitality.',
    color: 'oklch(0.68 0.13 75)',
  },
  {
    key: 'lowSelfEsteem',
    label: 'Low self-esteem',
    description: 'Diminished sense of self-worth.',
    color: 'oklch(0.58 0.17 350)',
  },
];

const TAB_DEFS = [
  { value: 'overview', label: 'Overview', count: null },
  {
    value: 'depression',
    label: 'Depression',
    count: DEPRESSION_DIMENSIONS.length,
  },
  { value: 'anxiety', label: 'Anxiety', count: ANXIETY_DIMENSIONS.length },
  { value: 'wellness', label: 'Wellness', count: WELLNESS_DIMENSIONS.length },
] as const;

export function BiomarkersPanel({ points, baseline }: PanelProps) {
  return (
    <Tabs defaultValue="overview" className="gap-4">
      <TabsList className="self-start">
        {TAB_DEFS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <TrajectoryChart points={points} baseline={baseline} />
      </TabsContent>

      <TabsContent value="depression">
        <DimensionGrid
          subtitle="Apollo depression dimensions — the eight PHQ-9 facets the model scores from your voice."
          dimensions={DEPRESSION_DIMENSIONS}
          points={points}
        />
      </TabsContent>

      <TabsContent value="anxiety">
        <DimensionGrid
          subtitle="Apollo anxiety dimensions — the seven GAD-7 facets the model scores from your voice."
          dimensions={ANXIETY_DIMENSIONS}
          points={points}
        />
      </TabsContent>

      <TabsContent value="wellness">
        <DimensionGrid
          subtitle="Helios wellness dimensions — broader signals beyond the formal questionnaires."
          dimensions={WELLNESS_DIMENSIONS}
          points={points}
        />
      </TabsContent>
    </Tabs>
  );
}

function DimensionGrid({
  subtitle,
  dimensions,
  points,
}: {
  subtitle: string;
  dimensions: DimensionDef[];
  points: TrajectoryPointDto[];
}) {
  const hasAnyReading = points.some((p) => p.biomarkers != null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-4"
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        {subtitle}{' '}
        <span className="text-muted-foreground/70">
          Each card shows the latest 0-1 reading on a severity meter, and the
          trend across your check-ins once you have two or more.
        </span>
      </p>

      {!hasAnyReading && (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Once you record your first check-in the per-dimension readings will
            appear here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dimensions.map((dim) => (
          <BiomarkerSparkline
            key={dim.key}
            label={dim.label}
            description={dim.description}
            metricKey={dim.key}
            points={points}
            color={dim.color}
            invertSentiment={dim.invertSentiment}
          />
        ))}
      </div>
    </motion.div>
  );
}

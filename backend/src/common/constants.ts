export const BASELINE_MIN_CHECKINS = 7;
export const BASELINE_WINDOW_DAYS = 14;
export const ROLLING_WINDOW_DAYS = 7;
export const DIVERGENCE_STDDEV_THRESHOLD = 2;

export const APOLLO_DEPRESSION_DIMENSIONS = [
  'anhedonia',
  'lowMood',
  'sleepIssues',
  'lowEnergy',
  'appetite',
  'worthlessness',
  'concentration',
  'psychomotor',
] as const;

export const APOLLO_ANXIETY_DIMENSIONS = [
  'nervousness',
  'uncontrollableWorry',
  'excessiveWorry',
  'troubleRelaxing',
  'restlessness',
  'irritability',
  'dread',
] as const;

export const HELIOS_WELLNESS_DIMENSIONS = [
  'distress',
  'stress',
  'burnout',
  'fatigue',
  'lowSelfEsteem',
] as const;

export type ApolloDepressionDimension =
  (typeof APOLLO_DEPRESSION_DIMENSIONS)[number];
export type ApolloAnxietyDimension =
  (typeof APOLLO_ANXIETY_DIMENSIONS)[number];
export type HeliosWellnessDimension =
  (typeof HELIOS_WELLNESS_DIMENSIONS)[number];

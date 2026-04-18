/**
 * Standard PHQ-9 (depression) and GAD-7 (generalised anxiety) item banks plus
 * scoring helpers, faithful to the published instruments.
 *
 * Sources (verified Apr 2026):
 *   • PHQ-9: Spitzer/Kroenke/Williams, 1999. 9 items × 0-3, asks about the last
 *     2 weeks. Total = SUM of items, range 0-27. Severity bands:
 *       0-4 minimal · 5-9 mild · 10-14 moderate · 15-19 mod-severe · 20-27 severe.
 *     Item 9 is the suicidal-ideation safety item; in this product we never ask
 *     it directly — the agent's safety prompt covers it instead. That means
 *     what we actually compute is the PHQ-8 (see below), not the PHQ-9.
 *   • PHQ-8: Kroenke et al. 2009 — the validated 8-item depression measure that
 *     drops PHQ-9 item 9. Sum of 8 items × 0-3 = range 0-24. Crucially, PHQ-8
 *     uses the SAME severity bands as PHQ-9 (0-4 / 5-9 / 10-14 / 15-19 / 20+)
 *     and the same ≥10 screening cut-point, which is exactly why we can keep
 *     reporting "PHQ-9 severity" honestly even with Q9 stripped out.
 *   • GAD-7: Spitzer et al., 2006. 7 items × 0-3, asks about the last 2 weeks.
 *     Total = SUM of items, range 0-21. Severity bands:
 *       0-4 minimal · 5-9 mild · 10-14 moderate · 15-21 severe.
 *     ≥10 is the standard diagnostic cut-point (89% sens / 82% spec).
 *
 * Each item carries a `voicePrompt` — a softer, more conversational rewording
 * for the agent to weave in naturally. The verbatim `text` is also kept so we
 * can render the standard wording in the triage report / PDF.
 */

export type QuestionnaireInstrument = 'phq9' | 'gad7';

export interface QuestionnaireItem {
  id: string;
  instrument: QuestionnaireInstrument;
  /** 1-indexed position in the original published instrument. */
  index: number;
  /** Verbatim instrument wording. Shown in the triage report. */
  text: string;
  /** Softer phrasing the voice agent uses in conversation. */
  voicePrompt: string;
  /**
   * Excluded from random rotation. True only for PHQ-9 item 9 (suicidal
   * ideation), which the safety prompt covers separately.
   */
  rotationExcluded?: boolean;
}

export const PHQ9_ITEMS: readonly QuestionnaireItem[] = [
  {
    id: 'phq9.1',
    instrument: 'phq9',
    index: 1,
    text: 'Little interest or pleasure in doing things',
    voicePrompt:
      "Over the last couple of weeks, how often have you had little interest or pleasure in doing things you usually enjoy?",
  },
  {
    id: 'phq9.2',
    instrument: 'phq9',
    index: 2,
    text: 'Feeling down, depressed, or hopeless',
    voicePrompt:
      "And over the last two weeks, how often have you felt down, depressed, or hopeless?",
  },
  {
    id: 'phq9.3',
    instrument: 'phq9',
    index: 3,
    text: 'Trouble falling or staying asleep, or sleeping too much',
    voicePrompt:
      "How has sleep been? Any trouble falling asleep, staying asleep, or sleeping too much over the last fortnight?",
  },
  {
    id: 'phq9.4',
    instrument: 'phq9',
    index: 4,
    text: 'Feeling tired or having little energy',
    voicePrompt:
      "How often have you felt tired or low on energy over the last two weeks?",
  },
  {
    id: 'phq9.5',
    instrument: 'phq9',
    index: 5,
    text: 'Poor appetite or overeating',
    voicePrompt:
      "How's your appetite been? Eating much less than usual, or more, over the last couple of weeks?",
  },
  {
    id: 'phq9.6',
    instrument: 'phq9',
    index: 6,
    text:
      'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    voicePrompt:
      "Over the last two weeks, how often have you felt bad about yourself — like you've let yourself or someone close to you down?",
  },
  {
    id: 'phq9.7',
    instrument: 'phq9',
    index: 7,
    text:
      'Trouble concentrating on things, such as reading the newspaper or watching television',
    voicePrompt:
      "Have you had trouble concentrating on things — reading, conversations, watching TV — over the last fortnight?",
  },
  {
    id: 'phq9.8',
    instrument: 'phq9',
    index: 8,
    text:
      'Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual',
    voicePrompt:
      "Have you noticed yourself moving or speaking unusually slowly — or the other way, feeling really restless or fidgety — over the last two weeks?",
  },
  {
    id: 'phq9.9',
    instrument: 'phq9',
    index: 9,
    text:
      'Thoughts that you would be better off dead, or of hurting yourself in some way',
    voicePrompt:
      'This one is sensitive — over the last two weeks, have you had any thoughts that you would be better off dead, or of hurting yourself?',
    rotationExcluded: true,
  },
] as const;

export const GAD7_ITEMS: readonly QuestionnaireItem[] = [
  {
    id: 'gad7.1',
    instrument: 'gad7',
    index: 1,
    text: 'Feeling nervous, anxious, or on edge',
    voicePrompt:
      "Over the last two weeks, how often have you felt nervous, anxious, or on edge?",
  },
  {
    id: 'gad7.2',
    instrument: 'gad7',
    index: 2,
    text: 'Not being able to stop or control worrying',
    voicePrompt:
      "How often have you found it hard to stop or control worrying over the last fortnight?",
  },
  {
    id: 'gad7.3',
    instrument: 'gad7',
    index: 3,
    text: 'Worrying too much about different things',
    voicePrompt:
      "Over the last couple of weeks, how often have you been worrying about lots of different things?",
  },
  {
    id: 'gad7.4',
    instrument: 'gad7',
    index: 4,
    text: 'Trouble relaxing',
    voicePrompt:
      "Have you had trouble relaxing — really switching off — over the last two weeks?",
  },
  {
    id: 'gad7.5',
    instrument: 'gad7',
    index: 5,
    text: 'Being so restless that it is hard to sit still',
    voicePrompt:
      "How often have you felt so restless that it's hard to sit still, over the last fortnight?",
  },
  {
    id: 'gad7.6',
    instrument: 'gad7',
    index: 6,
    text: 'Becoming easily annoyed or irritable',
    voicePrompt:
      "Over the last two weeks, have you been getting annoyed or irritable more easily than usual?",
  },
  {
    id: 'gad7.7',
    instrument: 'gad7',
    index: 7,
    text: 'Feeling afraid, as if something awful might happen',
    voicePrompt:
      "And how often have you felt afraid, like something bad might happen, over the last fortnight?",
  },
] as const;

export const ALL_ITEMS: readonly QuestionnaireItem[] = [
  ...PHQ9_ITEMS,
  ...GAD7_ITEMS,
] as const;

export const ROTATABLE_ITEMS: readonly QuestionnaireItem[] = ALL_ITEMS.filter(
  (i) => !i.rotationExcluded,
);

export const ITEMS_BY_ID: ReadonlyMap<string, QuestionnaireItem> = new Map(
  ALL_ITEMS.map((i) => [i.id, i]),
);

/** Standard 0-3 response set used by both instruments. */
export const RESPONSE_SCALE = [
  { score: 0, label: 'Not at all' },
  { score: 1, label: 'Several days' },
  { score: 2, label: 'More than half the days' },
  { score: 3, label: 'Nearly every day' },
] as const;

export type Severity = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';

/**
 * Standard PHQ-9 / PHQ-8 severity bands (Kroenke 2001; 2009).
 *   0-4 minimal · 5-9 mild · 10-14 moderate · 15-19 mod-severe · 20+ severe
 *
 * These bands are validated for PHQ-8 too — Kroenke et al. 2009 explicitly
 * carried them across when item 9 is dropped. ≥10 is the screening cut-point.
 */
export function severityForPhq9(total: number): Severity {
  if (total >= 20) return 'severe';
  if (total >= 15) return 'moderately_severe';
  if (total >= 10) return 'moderate';
  if (total >= 5) return 'mild';
  return 'minimal';
}

/**
 * Standard GAD-7 severity bands (Spitzer 2006).
 *   0-4 minimal · 5-9 mild · 10-14 moderate · 15-21 severe
 *
 * ≥10 is the diagnostic cut-point (89% sens, 82% spec).
 */
export function severityForGad7(total: number): Severity {
  if (total >= 15) return 'severe';
  if (total >= 10) return 'moderate';
  if (total >= 5) return 'mild';
  return 'minimal';
}

/**
 * Standard PHQ-9/GAD-7 scoring is a SUM of item responses — nothing more.
 * No mean projection, no scaling. We report the raw sum as the canonical
 * total and let the FE describe coverage separately.
 */
export function sumScores(
  responses: { questionId: string; score: number }[],
): number {
  return responses.reduce((acc, r) => acc + r.score, 0);
}

/**
 * Original Spitzer scoring rule for handling missing items (PHQ-9 manual,
 * also adopted in GAD-7 practice): a total is considered VALID when at most
 * 20% of items are missing in the rolling window — i.e. ≥80% coverage. Below
 * that, the score is shown but flagged as "partial" and clinicians are warned
 * not to read severity from it.
 */
export const VALID_COVERAGE_RATIO = 0.8;

export function isValidCoverage(answered: number, total: number): boolean {
  if (total === 0) return false;
  return answered / total >= VALID_COVERAGE_RATIO;
}

/**
 * Theoretical maximum total for an instrument given the items that we
 * actually rotate (i.e. how high `sumScores` can ever be). For our build:
 *   • PHQ-9 → 8 rotatable items (Q9 excluded) × 3 = 24 (= PHQ-8 maximum)
 *   • GAD-7 → 7 items × 3 = 21
 */
export function maxScoreForInstrument(
  items: readonly QuestionnaireItem[],
): number {
  return items.filter((i) => !i.rotationExcluded).length * 3;
}

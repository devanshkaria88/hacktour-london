/**
 * Seed a realistic 21-day check-in history for a single user (default: Dev,
 * `devansh8801@gmail.com`). Designed to demonstrate the full product surface:
 *
 *   • Days 1-14 form a stable personal baseline (low/moderate values, jitter).
 *   • Days 15-21 ramp upward across most dimensions, deliberately tipping the
 *     7-day rolling composite over +2σ so the divergence detector trips and a
 *     triage event is created against day 21's check-in.
 *
 * Run with:
 *   cd backend && npm run seed:dev
 *   # or:  SEED_USER_EMAIL=other@example.com npm run seed:dev
 *
 * The script wipes the target user's existing checkins / biomarker readings /
 * triage events first, then re-inserts a deterministic seed sequence (RNG is
 * seeded so successive runs produce identical data).
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { UserEntity } from '../../modules/users/entities/user.entity';
import { CheckinEntity } from '../../modules/checkins/entities/checkin.entity';
import { BiomarkerReadingEntity } from '../../modules/biomarkers/entities/biomarker-reading.entity';
import {
  DivergenceComposite,
  TriageEventEntity,
} from '../../modules/triage/entities/triage-event.entity';
import {
  APOLLO_ANXIETY_DIMENSIONS,
  APOLLO_DEPRESSION_DIMENSIONS,
  HELIOS_WELLNESS_DIMENSIONS,
} from '../../common/constants';
import { QuestionnaireResponseEntity } from '../../modules/questionnaire/entities/questionnaire-response.entity';
import {
  GAD7_ITEMS,
  PHQ9_ITEMS,
  ROTATABLE_ITEMS,
  type QuestionnaireItem,
} from '../../modules/questionnaire/questionnaire.constants';

const TARGET_EMAIL = process.env.SEED_USER_EMAIL ?? 'devansh8801@gmail.com';
const DAYS = 21;
// Start the ramp earlier (day 8) so the baseline window (first 14 days)
// already includes some natural upward drift. That widens the baseline
// stddev and keeps the divergence reading in a believable range (~3-6σ)
// instead of "+15σ" theatre.
const RAMP_START_DAY = 7;

type DimKey =
  | (typeof APOLLO_DEPRESSION_DIMENSIONS)[number]
  | (typeof APOLLO_ANXIETY_DIMENSIONS)[number]
  | (typeof HELIOS_WELLNESS_DIMENSIONS)[number];

interface DimensionProfile {
  baseline: number;
  peak: number;
}

/**
 * Per-dimension baseline/peak values. Tuned by hand so the trajectory
 * tells a coherent story: a calm baseline followed by a depression-leaning
 * escalation (anhedonia, low mood, low energy, sleep) — the kind of
 * pattern that should warrant a GP conversation but isn't a crisis.
 */
const DIMENSION_PROFILES: Record<DimKey, DimensionProfile> = {
  // Apollo · depression — primary movers
  anhedonia: { baseline: 0.3, peak: 0.62 },
  lowMood: { baseline: 0.32, peak: 0.65 },
  sleepIssues: { baseline: 0.34, peak: 0.7 },
  lowEnergy: { baseline: 0.36, peak: 0.66 },
  appetite: { baseline: 0.28, peak: 0.5 },
  worthlessness: { baseline: 0.24, peak: 0.55 },
  concentration: { baseline: 0.32, peak: 0.58 },
  psychomotor: { baseline: 0.26, peak: 0.45 },
  // Apollo · anxiety — secondary movers
  nervousness: { baseline: 0.34, peak: 0.5 },
  uncontrollableWorry: { baseline: 0.32, peak: 0.46 },
  excessiveWorry: { baseline: 0.3, peak: 0.44 },
  troubleRelaxing: { baseline: 0.36, peak: 0.55 },
  restlessness: { baseline: 0.3, peak: 0.46 },
  irritability: { baseline: 0.32, peak: 0.5 },
  dread: { baseline: 0.26, peak: 0.4 },
  // Helios · wellness
  distress: { baseline: 0.34, peak: 0.6 },
  stress: { baseline: 0.42, peak: 0.65 },
  burnout: { baseline: 0.32, peak: 0.6 },
  fatigue: { baseline: 0.38, peak: 0.65 },
  lowSelfEsteem: { baseline: 0.28, peak: 0.55 },
};

/** Tiny seeded RNG so the seed is deterministic across runs. */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seededRng(42);
const noise = (range: number): number => (rng() - 0.5) * range;

function valueForDay(profile: DimensionProfile, dayIdx: number): number {
  const ramp =
    dayIdx < RAMP_START_DAY
      ? 0
      : Math.min(1, (dayIdx - RAMP_START_DAY + 1) / (DAYS - RAMP_START_DAY));
  const blended = profile.baseline + (profile.peak - profile.baseline) * ramp;
  // Real check-ins fluctuate. Wider jitter on baseline days makes the
  // computed stddev realistic, which in turn keeps the divergence sigma
  // reading believable (a single-digit σ instead of "+15σ" theatre).
  const jitter = noise(0.22);
  return clamp01(blended + jitter);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0),
  );
}

const TRANSCRIPT_SAMPLES = [
  'Pretty steady today. Slept okay, work was fine.',
  'Quiet morning. Went for a walk before lunch, that helped.',
  'Felt a bit flat but nothing dramatic. Manageable.',
  "Decent day. Caught up with a friend, that lifted things.",
  'Bit tired but otherwise okay. Eating normally.',
  'Average. Nothing to flag really.',
  'Had a productive afternoon. Mood was steady.',
  "Sleep wasn't great but I got through the day.",
  'Felt a bit more on edge than usual. Hard to explain.',
  "Tired. Didn't feel like doing much in the evening.",
  'Lower energy than I would like. Less interest in things.',
  "Hard to concentrate today. Kept zoning out.",
  'Pretty heavy day. Felt low for most of it.',
  'Sleeping badly all week. Worn out and a bit hopeless.',
];

async function main() {
  await AppDataSource.initialize();

  try {
    const userRepo = AppDataSource.getRepository(UserEntity);
    const checkinRepo = AppDataSource.getRepository(CheckinEntity);
    const readingRepo = AppDataSource.getRepository(BiomarkerReadingEntity);
    const triageRepo = AppDataSource.getRepository(TriageEventEntity);
    const responseRepo = AppDataSource.getRepository(QuestionnaireResponseEntity);

    const user = await userRepo.findOne({ where: { email: TARGET_EMAIL } });
    if (!user) {
      console.error(
        `\n  ✗ No user found with email "${TARGET_EMAIL}".\n` +
          `    Sign up first via the /signup page, or pass SEED_USER_EMAIL=...\n`,
      );
      process.exit(1);
    }

    console.log(`\n  → Seeding ${DAYS} days for ${user.displayName} (${user.email})`);

    // Wipe existing data for this user only — keeps other accounts untouched.
    await triageRepo.delete({ userId: user.id });
    await responseRepo.delete({ userId: user.id });
    const existingCheckins = await checkinRepo.find({
      where: { userId: user.id },
      select: { id: true },
    });
    if (existingCheckins.length > 0) {
      const ids = existingCheckins.map((c) => c.id);
      await readingRepo.delete({ checkinId: ids as unknown as string });
      await checkinRepo.delete({ userId: user.id });
      console.log(`    cleared ${existingCheckins.length} existing check-in(s)`);
    }

    const today = startOfTodayUtc();
    const phq9Series: number[] = [];
    const gad7Series: number[] = [];
    const checkinIds: string[] = [];
    let totalAnswers = 0;
    // Round-robin pointer across the 15 rotatable items. Each day pulls 4
    // consecutive items, matching how QuestionnaireService.pickQuestionsForUser
    // would behave once the user has a full history (least-recently-asked).
    let rotationCursor = 0;

    for (let day = 0; day < DAYS; day++) {
      const recordedAt = new Date(today);
      recordedAt.setUTCDate(today.getUTCDate() - (DAYS - 1 - day));

      // Compute every dimension for this day.
      const dimensions: Record<string, number> = {};
      for (const key of [
        ...APOLLO_DEPRESSION_DIMENSIONS,
        ...APOLLO_ANXIETY_DIMENSIONS,
        ...HELIOS_WELLNESS_DIMENSIONS,
      ] as DimKey[]) {
        dimensions[key] = round3(valueForDay(DIMENSION_PROFILES[key], day));
      }

      const phq9Composite = round3(
        mean(APOLLO_DEPRESSION_DIMENSIONS.map((k) => dimensions[k])),
      );
      const gad7Composite = round3(
        mean(APOLLO_ANXIETY_DIMENSIONS.map((k) => dimensions[k])),
      );
      phq9Series.push(phq9Composite);
      gad7Series.push(gad7Composite);

      const checkin = await checkinRepo.save(
        checkinRepo.create({
          userId: user.id,
          recordedAt,
          transcript: TRANSCRIPT_SAMPLES[day % TRANSCRIPT_SAMPLES.length],
          audioStoragePath: '',
          audioDurationSec: 60 + Math.floor(rng() * 30),
          selfRating: null,
        }),
      );
      checkinIds.push(checkin.id);

      await readingRepo.save(
        readingRepo.create({
          checkinId: checkin.id,
          ...(dimensions as Record<string, number>),
          phq9Composite,
          gad7Composite,
        }),
      );

      // Self-report items: pick 4 from the rotatable bank and score them
      // consistently with the biomarker arc — calm baseline (mostly 0s and
      // 1s) ramping into a depression-leaning escalation (more 2s, scattered
      // 3s) over the back half. Score is derived from the same per-dimension
      // profile that drove the biomarker reading, so PHQ-9/GAD-7 totals
      // climb in lockstep with the vocal signal — exactly the pattern a real
      // user with worsening symptoms would produce.
      const items = pickQuestionsForDay(rotationCursor, 4);
      rotationCursor = (rotationCursor + 4) % ROTATABLE_ITEMS.length;
      for (const item of items) {
        const score = scoreForItem(item, dimensions);
        await responseRepo.save(
          responseRepo.create({
            userId: user.id,
            checkinId: checkin.id,
            questionId: item.id,
            instrument: item.instrument,
            score,
            rawAnswer: rawAnswerSample(score),
            askedAt: recordedAt,
          }),
        );
        totalAnswers++;
      }
    }

    console.log(
      `    seeded ${DAYS} check-ins (PHQ-9: ${phq9Series[0].toFixed(2)} → ${phq9Series[DAYS - 1].toFixed(2)}, ` +
        `GAD-7: ${gad7Series[0].toFixed(2)} → ${gad7Series[DAYS - 1].toFixed(2)})`,
    );
    console.log(
      `    seeded ${totalAnswers} self-report answer(s) across PHQ-9 + GAD-7`,
    );

    // Manually compute divergence on the final state. Uses the same windows
    // as DivergenceDetectorService (baseline = first 14, recent = last 7).
    const baselineWindow = phq9Series.slice(0, 14);
    const recentWindow = phq9Series.slice(-7);
    const baselineMean = mean(baselineWindow);
    const baselineStddev = stddev(baselineWindow);
    const observedValue = mean(recentWindow);
    const sigmas =
      baselineStddev > 0
        ? (observedValue - baselineMean) / baselineStddev
        : 0;

    if (sigmas > 2) {
      const triggeringCheckinId = checkinIds[checkinIds.length - 1];
      const triggeredAt = new Date(today);
      const triggerReason =
        `Seven-day rolling average of PHQ-9 composite ` +
        `(${observedValue.toFixed(2)}) has exceeded the personal baseline ` +
        `(mean ${baselineMean.toFixed(2)}, stddev ${baselineStddev.toFixed(2)}) ` +
        `by ${sigmas.toFixed(2)} standard deviations.`;

      await triageRepo.save(
        triageRepo.create({
          userId: user.id,
          triggeredAt,
          triggerReason,
          composite: DivergenceComposite.PHQ9,
          triggeringCheckinId,
          baselineMean,
          baselineStddev,
          observedValue,
        }),
      );
      console.log(
        `    triage event created (PHQ-9 +${sigmas.toFixed(2)}σ above baseline)`,
      );
    } else {
      console.log(
        `    no divergence event (PHQ-9 only +${sigmas.toFixed(2)}σ — adjust DIMENSION_PROFILES.peak to push higher)`,
      );
    }

    console.log(`\n  ✓ Done. Open /trajectory to see it.\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Map a PHQ-9 / GAD-7 item onto the biomarker dimension that drives it
 * conceptually. The seed then converts that 0-1 dimension reading into a
 * 0-3 PHQ/GAD score so the self-report trajectory tracks the vocal
 * trajectory — exactly what we'd expect to see in a real user whose
 * biomarkers are escalating because their lived symptoms are escalating.
 */
const QUESTION_TO_DIMENSION: Record<string, keyof typeof DIMENSION_PROFILES> = {
  // PHQ-9 items 1-8 (item 9 is excluded from rotation) → Apollo depression
  'phq9.1': 'anhedonia',
  'phq9.2': 'lowMood',
  'phq9.3': 'sleepIssues',
  'phq9.4': 'lowEnergy',
  'phq9.5': 'appetite',
  'phq9.6': 'worthlessness',
  'phq9.7': 'concentration',
  'phq9.8': 'psychomotor',
  // GAD-7 items 1-7 → Apollo anxiety
  'gad7.1': 'nervousness',
  'gad7.2': 'uncontrollableWorry',
  'gad7.3': 'excessiveWorry',
  'gad7.4': 'troubleRelaxing',
  'gad7.5': 'restlessness',
  'gad7.6': 'irritability',
  'gad7.7': 'dread',
};

function pickQuestionsForDay(
  cursor: number,
  count: number,
): QuestionnaireItem[] {
  // Walk the full rotatable bank circularly so over the 21-day window every
  // item lands ~5-6 times — gives the rolling 14-day total enough coverage
  // to be marked `coverageValid` on the latest summary.
  const out: QuestionnaireItem[] = [];
  for (let i = 0; i < count; i++) {
    out.push(ROTATABLE_ITEMS[(cursor + i) % ROTATABLE_ITEMS.length]);
  }
  return out;
}

function scoreForItem(
  item: QuestionnaireItem,
  dimensions: Record<string, number>,
): number {
  const dim = QUESTION_TO_DIMENSION[item.id];
  const raw = dim != null ? (dimensions[dim] ?? 0) : 0;
  // Map the 0-1 dimension reading onto the 0-3 PHQ/GAD response scale using
  // the canonical thresholds we use elsewhere for severity bands. A small
  // amount of jitter keeps adjacent days from looking identical.
  const jittered = raw + (rng() - 0.5) * 0.08;
  if (jittered >= 0.7) return 3;
  if (jittered >= 0.5) return 2;
  if (jittered >= 0.3) return 1;
  return 0;
}

function rawAnswerSample(score: number): string {
  const bank: Record<number, string[]> = {
    0: ['No, not really.', 'Nah, not at all.', "Honestly, that's been fine."],
    1: ['A few days, here and there.', 'A bit, now and then.', 'Just occasionally.'],
    2: ['Most days, yeah.', 'Quite a lot of the time.', "More than half the days, I'd say."],
    3: ['Pretty much every day.', "Yeah, all the time.", "Constantly, really."],
  };
  const options = bank[score] ?? bank[0];
  return options[Math.floor(rng() * options.length)];
}

// Re-export the items so a future caller can introspect the bank without
// reaching into the questionnaire module directly.
export { PHQ9_ITEMS as DEV_SEED_PHQ9_ITEMS, GAD7_ITEMS as DEV_SEED_GAD7_ITEMS };

main().catch((err) => {
  console.error('\n  ✗ Seed failed:', err);
  process.exit(1);
});

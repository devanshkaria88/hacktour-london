import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforce "one check-in per user per UTC day". Multiple legitimate use-cases
 * argued for this:
 *
 *  - The trajectory chart plots one X-tick per day, so multi-per-day points
 *    overlap and either pile up at the same X coordinate or get sampled
 *    arbitrarily by Recharts.
 *  - The personal baseline + divergence math assumes one observation per
 *    day; duplicates skew the rolling-7 mean and can manufacture spurious
 *    sigmas.
 *  - The seed script creates 1/day historical data, so running a real call
 *    on the same day would otherwise leave two rows for "today" and the
 *    user would see both on the trajectory.
 *
 * Strategy:
 *  1. Collapse existing duplicates: for each (user_id, day) with >1
 *     non-deleted check-ins, keep ONLY the most recent one. All FKs from
 *     biomarker_readings / triage_events / questionnaire_responses already
 *     cascade on DELETE, so the dependent rows go with them.
 *  2. Install a partial unique index on (user_id, recorded_at::date) for
 *     non-deleted rows. This is the DB-level guarantee — even if an
 *     application bug bypasses the upsert, Postgres will reject the second
 *     insert.
 *
 * The service layer separately implements an explicit "delete-then-insert"
 * upsert in CheckinsService.persistAnalysis so the FE always sees the
 * freshest values for today, never a stale row that won the race.
 */
export class OneCheckinPerDay1776700000000 implements MigrationInterface {
  name = 'OneCheckinPerDay1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Collapse existing duplicates. The DELETE relies on FK cascades for
    //    biomarker_readings / triage_events / questionnaire_responses to
    //    sweep dependent rows. We keep the row with the latest recorded_at.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, (recorded_at AT TIME ZONE 'UTC')::date
            ORDER BY recorded_at DESC, id DESC
          ) AS rn
        FROM checkins
        WHERE is_deleted = false
      )
      DELETE FROM checkins
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

    // 2) Partial unique index — only enforced for live (non-deleted) rows
    //    so soft-deletes don't block re-recording on the same calendar day.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_checkins_user_day"
      ON "checkins" (user_id, ((recorded_at AT TIME ZONE 'UTC')::date))
      WHERE is_deleted = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_checkins_user_day";`);
    // We deliberately do NOT restore deleted check-ins — they are gone.
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `questionnaire_responses` table — one row per PHQ-9/GAD-7 item
 * the voice agent asks during a check-in. Allows us to compute rolling
 * 14-day PHQ-9 (0-27) and GAD-7 (0-21) totals + severity bands without
 * mutating the historical answers themselves.
 */
export class AddQuestionnaireResponses1776600000000
  implements MigrationInterface
{
  name = 'AddQuestionnaireResponses1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "questionnaire_responses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "user_id" uuid NOT NULL,
        "checkin_id" uuid,
        "question_id" varchar(32) NOT NULL,
        "instrument" varchar(8) NOT NULL,
        "score" smallint NOT NULL,
        "raw_answer" text,
        "asked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_questionnaire_responses" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_questionnaire_score_range" CHECK ("score" BETWEEN 0 AND 3),
        CONSTRAINT "CHK_questionnaire_instrument_enum" CHECK ("instrument" IN ('phq9', 'gad7'))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_responses"
      ADD CONSTRAINT "FK_questionnaire_responses_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_responses"
      ADD CONSTRAINT "FK_questionnaire_responses_checkin"
      FOREIGN KEY ("checkin_id") REFERENCES "checkins"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_questionnaire_user_asked_at" ON "questionnaire_responses" ("user_id", "asked_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_questionnaire_user_question_asked" ON "questionnaire_responses" ("user_id", "question_id", "asked_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_questionnaire_user_question_asked"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_questionnaire_user_asked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "questionnaire_responses" DROP CONSTRAINT "FK_questionnaire_responses_checkin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "questionnaire_responses" DROP CONSTRAINT "FK_questionnaire_responses_user"`,
    );
    await queryRunner.query(`DROP TABLE "questionnaire_responses"`);
  }
}

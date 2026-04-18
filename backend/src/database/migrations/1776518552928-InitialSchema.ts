import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776518552928 implements MigrationInterface {
    name = 'InitialSchema1776518552928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "biomarker_readings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "checkin_id" uuid NOT NULL, "anhedonia" double precision, "low_mood" double precision, "sleep_issues" double precision, "low_energy" double precision, "appetite" double precision, "worthlessness" double precision, "concentration" double precision, "psychomotor" double precision, "nervousness" double precision, "uncontrollable_worry" double precision, "excessive_worry" double precision, "trouble_relaxing" double precision, "restlessness" double precision, "irritability" double precision, "dread" double precision, "distress" double precision, "stress" double precision, "burnout" double precision, "fatigue" double precision, "low_self_esteem" double precision, "phq9_composite" double precision, "gad7_composite" double precision, CONSTRAINT "UQ_f9075b4dcdca6be623950f0fd9f" UNIQUE ("checkin_id"), CONSTRAINT "REL_f9075b4dcdca6be623950f0fd9" UNIQUE ("checkin_id"), CONSTRAINT "PK_d7d3b8f494593fb05c2040789c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "checkins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "user_id" uuid NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "transcript" text, "audio_duration_sec" integer NOT NULL DEFAULT '0', "audio_storage_path" character varying(500), "self_rating" integer, CONSTRAINT "PK_99c62633386398b154840f0708c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fc53e8e4364f501d65e757c3c3" ON "checkins" ("user_id", "recorded_at") `);
        await queryRunner.query(`CREATE TYPE "public"."triage_events_composite_enum" AS ENUM('phq9', 'gad7')`);
        await queryRunner.query(`CREATE TABLE "triage_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "user_id" uuid NOT NULL, "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "trigger_reason" text NOT NULL, "composite" "public"."triage_events_composite_enum" NOT NULL, "triggering_checkin_id" uuid NOT NULL, "baseline_mean" double precision NOT NULL, "baseline_stddev" double precision NOT NULL, "observed_value" double precision NOT NULL, CONSTRAINT "PK_39f6d54cab085cf3e1239d354fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7eda597408f6e2f147ef67a588" ON "triage_events" ("user_id", "triggered_at") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_deleted" boolean NOT NULL DEFAULT false, "name" character varying(255) NOT NULL, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "biomarker_readings" ADD CONSTRAINT "FK_f9075b4dcdca6be623950f0fd9f" FOREIGN KEY ("checkin_id") REFERENCES "checkins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkins" ADD CONSTRAINT "FK_4bee1e59fa58838948f443e531f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "triage_events" ADD CONSTRAINT "FK_50e7094266b7fb6b5449f76faba" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "triage_events" ADD CONSTRAINT "FK_5e2e43306ff86f61ab52b5c6cfd" FOREIGN KEY ("triggering_checkin_id") REFERENCES "checkins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "triage_events" DROP CONSTRAINT "FK_5e2e43306ff86f61ab52b5c6cfd"`);
        await queryRunner.query(`ALTER TABLE "triage_events" DROP CONSTRAINT "FK_50e7094266b7fb6b5449f76faba"`);
        await queryRunner.query(`ALTER TABLE "checkins" DROP CONSTRAINT "FK_4bee1e59fa58838948f443e531f"`);
        await queryRunner.query(`ALTER TABLE "biomarker_readings" DROP CONSTRAINT "FK_f9075b4dcdca6be623950f0fd9f"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7eda597408f6e2f147ef67a588"`);
        await queryRunner.query(`DROP TABLE "triage_events"`);
        await queryRunner.query(`DROP TYPE "public"."triage_events_composite_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc53e8e4364f501d65e757c3c3"`);
        await queryRunner.query(`DROP TABLE "checkins"`);
        await queryRunner.query(`DROP TABLE "biomarker_readings"`);
    }

}

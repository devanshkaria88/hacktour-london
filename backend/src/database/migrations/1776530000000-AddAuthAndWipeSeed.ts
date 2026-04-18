import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds email/password auth columns to users, wipes the demo seed,
 * and ensures every check-in/triage event belongs to a real signed-up user.
 *
 * The original "Sam" demo user (id 0000…0001) is removed; FK cascades
 * delete its check-ins, biomarker readings, and triage events. New users
 * start at zero check-ins so their baseline + divergence card naturally
 * stay hidden until they have ≥7 historical points.
 */
export class AddAuthAndWipeSeed1776530000000 implements MigrationInterface {
  name = 'AddAuthAndWipeSeed1776530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users"`);

    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "name" TO "display_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "display_name" TYPE varchar(120)`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "display_name" TYPE varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "display_name" TO "name"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPremiumAndAutoBumpColumns20260402183000 implements MigrationInterface {
  name = 'AddPremiumAndAutoBumpColumns20260402183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD COLUMN IF NOT EXISTS "isPremium" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "source_option_id" character varying(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "auto_bump_interval_hours" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "next_auto_bump_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promotions_next_auto_bump"
      ON "promotions" ("next_auto_bump_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_promotions_next_auto_bump"`);
    await queryRunner.query(`
      ALTER TABLE "promotions" DROP COLUMN IF EXISTS "next_auto_bump_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotions" DROP COLUMN IF EXISTS "auto_bump_interval_hours"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotions" DROP COLUMN IF EXISTS "source_option_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "listings" DROP COLUMN IF EXISTS "isPremium"
    `);
  }
}


import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionPaymentColumns20260403150000 implements MigrationInterface {
  name = 'AddPromotionPaymentColumns20260403150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "payment_status" character varying(32) NOT NULL DEFAULT 'unpaid'
    `);

    await queryRunner.query(`
      ALTER TABLE "promotions"
      ADD COLUMN IF NOT EXISTS "payment_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promotions_payment_status"
      ON "promotions" ("payment_status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promotions_payment_id"
      ON "promotions" ("payment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_promotions_payment_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_promotions_payment_status"`);
    await queryRunner.query(`
      ALTER TABLE "promotions" DROP COLUMN IF EXISTS "payment_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "promotions" DROP COLUMN IF EXISTS "payment_status"
    `);
  }
}

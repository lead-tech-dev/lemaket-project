import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickupCodeToDeliveries20260213170000 implements MigrationInterface {
  name = 'AddPickupCodeToDeliveries20260213170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deliveries"
      ADD COLUMN IF NOT EXISTS "pickup_code" varchar(10),
      ADD COLUMN IF NOT EXISTS "pickup_code_verified_at" timestamp,
      ADD COLUMN IF NOT EXISTS "delivery_code" varchar(10),
      ADD COLUMN IF NOT EXISTS "delivery_code_verified_at" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deliveries"
      DROP COLUMN IF EXISTS "delivery_code_verified_at",
      DROP COLUMN IF EXISTS "delivery_code",
      DROP COLUMN IF EXISTS "pickup_code_verified_at",
      DROP COLUMN IF EXISTS "pickup_code"
    `);
  }
}

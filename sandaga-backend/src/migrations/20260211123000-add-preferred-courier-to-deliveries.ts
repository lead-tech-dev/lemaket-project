import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreferredCourierToDeliveries20260211123000 implements MigrationInterface {
  name = 'AddPreferredCourierToDeliveries20260211123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "preferred_courier_id" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ALTER COLUMN "preferred_courier_id" TYPE uuid USING NULLIF("preferred_courier_id"::text, '')::uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_preferred_courier_fk" FOREIGN KEY ("preferred_courier_id") REFERENCES "users"("id") ON DELETE SET NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_preferred_courier_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "preferred_courier_id"`
    );
  }
}

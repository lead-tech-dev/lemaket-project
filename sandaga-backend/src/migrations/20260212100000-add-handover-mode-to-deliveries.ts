import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandoverModeToDeliveries20260212100000 implements MigrationInterface {
  name = 'AddHandoverModeToDeliveries20260212100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "handover_mode" character varying(12) NOT NULL DEFAULT 'delivery'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deliveries" DROP COLUMN "handover_mode"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertCategorySlug20260201100000 implements MigrationInterface {
  name = 'AddAlertCategorySlug20260201100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD COLUMN IF NOT EXISTS "category_slug" varchar(140)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "alerts"
      DROP COLUMN IF EXISTS "category_slug"
    `);
  }
}

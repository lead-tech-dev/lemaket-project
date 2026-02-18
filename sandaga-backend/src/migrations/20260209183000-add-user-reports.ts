import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserReports20260209183000 implements MigrationInterface {
  name = 'AddUserReports20260209183000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD COLUMN IF NOT EXISTS "reported_user_id" uuid
    `)
    await queryRunner.query(`
      ALTER TABLE "reports"
      ALTER COLUMN "listing_id" DROP NOT NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD CONSTRAINT "FK_reports_reported_user"
      FOREIGN KEY ("reported_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_reported_user_id" ON "reports" ("reported_user_id")`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_reported_user_id"`)
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_reported_user"`)
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "reported_user_id"`)
    await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "listing_id" SET NOT NULL`)
  }
}

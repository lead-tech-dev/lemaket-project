import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourierVerification20260211124500 implements MigrationInterface {
  name = 'AddCourierVerification20260211124500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "courier_verification_status_enum" AS ENUM ('unverified','pending','approved','rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "courierVerificationStatus" "courier_verification_status_enum" DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS "courierVerificationDocumentUrl" varchar(255),
      ADD COLUMN IF NOT EXISTS "courierVerificationSubmittedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "courierVerificationReviewedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "courierVerificationReviewNotes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "courierVerificationStatus",
      DROP COLUMN IF EXISTS "courierVerificationDocumentUrl",
      DROP COLUMN IF EXISTS "courierVerificationSubmittedAt",
      DROP COLUMN IF EXISTS "courierVerificationReviewedAt",
      DROP COLUMN IF EXISTS "courierVerificationReviewNotes"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "courier_verification_status_enum"`);
  }
}

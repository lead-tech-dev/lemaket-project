import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyVerification20260205120000 implements MigrationInterface {
  name = 'AddCompanyVerification20260205120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_verification_status_enum') THEN
          CREATE TYPE "company_verification_status_enum" AS ENUM('unverified', 'pending', 'approved', 'rejected');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "companyNiu" varchar(50),
      ADD COLUMN IF NOT EXISTS "companyRccm" varchar(50),
      ADD COLUMN IF NOT EXISTS "companyCity" varchar(120),
      ADD COLUMN IF NOT EXISTS "companyVerificationStatus" "company_verification_status_enum" DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS "companyVerificationDocumentUrl" varchar(255),
      ADD COLUMN IF NOT EXISTS "companyVerificationSubmittedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "companyVerificationReviewedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "companyVerificationReviewNotes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "companyNiu",
      DROP COLUMN IF EXISTS "companyRccm",
      DROP COLUMN IF EXISTS "companyCity",
      DROP COLUMN IF EXISTS "companyVerificationStatus",
      DROP COLUMN IF EXISTS "companyVerificationDocumentUrl",
      DROP COLUMN IF EXISTS "companyVerificationSubmittedAt",
      DROP COLUMN IF EXISTS "companyVerificationReviewedAt",
      DROP COLUMN IF EXISTS "companyVerificationReviewNotes"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "company_verification_status_enum";
    `);
  }
}

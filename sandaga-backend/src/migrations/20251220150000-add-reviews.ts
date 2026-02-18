import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviews20251220150000 implements MigrationInterface {
  name = 'AddReviews20251220150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status_enum') THEN
          CREATE TYPE "review_status_enum" AS ENUM('pending','approved','rejected');
        END IF;
      END$$;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        "listing_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "reviewer_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" text NOT NULL,
        "location" varchar(80),
        "status" "review_status_enum" NOT NULL DEFAULT 'approved'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "UQ_reviews_reviewer_listing" UNIQUE ("reviewer_id", "listing_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reviews_seller_status" ON "reviews" ("seller_id","status")
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_listing"
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_seller"
      FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD CONSTRAINT "FK_reviews_reviewer"
      FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_reviewer"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_seller"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_listing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_seller_status"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "UQ_reviews_reviewer_listing"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "review_status_enum"`);
  }
}

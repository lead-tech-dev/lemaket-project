import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewTestimonialFlag20260223130000 implements MigrationInterface {
  name = 'AddReviewTestimonialFlag20260223130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "is_testimonial" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews"
      DROP COLUMN IF EXISTS "is_testimonial"
    `);
  }
}


import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReviewsMakeListingNullable20260209190000 implements MigrationInterface {
  name = 'ReviewsMakeListingNullable20260209190000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ALTER COLUMN "listing_id" DROP NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews"
      ALTER COLUMN "listing_id" SET NOT NULL
    `)
  }
}

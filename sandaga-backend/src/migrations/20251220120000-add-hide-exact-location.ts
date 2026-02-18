import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddHideExactLocation20251220120000 implements MigrationInterface {
  name = 'AddHideExactLocation20251220120000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure location is jsonb and add hideExact flag default false when missing
    await queryRunner.query(`ALTER TABLE "listings" ALTER COLUMN "location" TYPE jsonb USING ("location"::jsonb)`);
    await queryRunner.query(`
      UPDATE "listings"
      SET "location" = COALESCE("location", '{}'::jsonb) || jsonb_build_object(
        'hideExact',
        COALESCE(("location"->>'hideExact')::boolean, false)
      )
      WHERE "location" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: keep hideExact if present
    return;
  }
}

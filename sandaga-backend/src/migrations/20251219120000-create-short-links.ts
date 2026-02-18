import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateShortLinks20251219120000 implements MigrationInterface {
  name = 'CreateShortLinks20251219120000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "short_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" varchar(32) NOT NULL,
        "targetUrl" text NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_short_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_short_links_slug" UNIQUE ("slug")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_short_links_slug" ON "short_links" ("slug")`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_short_links_slug"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "short_links"`)
  }
}

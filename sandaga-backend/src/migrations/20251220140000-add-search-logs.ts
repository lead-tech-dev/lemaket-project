import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSearchLogs20251220140000 implements MigrationInterface {
  name = 'AddSearchLogs20251220140000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "query" character varying(160) NOT NULL,
        "normalizedQuery" character varying(160) NOT NULL,
        "resultCount" integer NOT NULL DEFAULT 0,
        "locale" character varying(10),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_logs_id" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_logs_normalized" ON "search_logs" ("normalizedQuery")`
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_logs_created_at" ON "search_logs" ("createdAt")`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_logs_created_at"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_logs_normalized"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "search_logs"`)
  }
}

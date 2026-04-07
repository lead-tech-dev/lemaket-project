import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchUnaccentTrgmAndPrefixIndexes20260407120000 implements MigrationInterface {
  name = 'AddSearchUnaccentTrgmAndPrefixIndexes20260407120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_available_extensions
          WHERE name = 'pg_trgm'
        ) THEN
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_logs_normalized_prefix"
      ON "search_logs" ("normalizedQuery" varchar_pattern_ops, "createdAt" DESC);
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'pg_trgm'
        )
        AND EXISTS (
          SELECT 1
          FROM pg_proc
          WHERE proname = 'lemaket_unaccent'
        ) THEN
          CREATE INDEX IF NOT EXISTS "IDX_listings_title_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent(COALESCE("title", ''))) gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_description_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent(COALESCE("description", ''))) gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_city_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent(COALESCE("location"->>'city', ''))) gin_trgm_ops);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_city_unaccent_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_description_unaccent_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_title_unaccent_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_logs_normalized_prefix"`);
  }
}

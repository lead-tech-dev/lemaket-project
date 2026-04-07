import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchPerformanceIndexes20260406200000 implements MigrationInterface {
  name = 'AddSearchPerformanceIndexes20260406200000';

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
      CREATE INDEX IF NOT EXISTS "IDX_search_logs_created_normalized"
      ON "search_logs" ("createdAt" DESC, "normalizedQuery");
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'pg_trgm'
        ) THEN
          CREATE INDEX IF NOT EXISTS "IDX_search_logs_normalized_trgm"
          ON "search_logs" USING GIN ("normalizedQuery" gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_address_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent(COALESCE("location"->>'address', ''))) gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_label_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent(COALESCE("location"->>'label', ''))) gin_trgm_ops);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_city_status_sort"
      ON "listings" ("city_id", "status", "publishedAt", "created_at", "id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_neighborhood_status_sort"
      ON "listings" ("neighborhood_id", "status", "publishedAt", "created_at", "id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_category_status_sort"
      ON "listings" ("category_id", "status", "publishedAt", "created_at", "id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_category_status_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_neighborhood_status_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_city_status_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_label_unaccent_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_address_unaccent_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_logs_normalized_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_logs_created_normalized"`);
  }
}

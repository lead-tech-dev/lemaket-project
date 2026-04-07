import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingsSearchIndexes20260404100000 implements MigrationInterface {
  name = 'AddListingsSearchIndexes20260404100000';

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
      CREATE INDEX IF NOT EXISTS "IDX_listings_status_sort"
      ON "listings" ("status", "isPremium", "isFeatured", "isBoosted", "publishedAt", "created_at", "id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_status_price_sort"
      ON "listings" ("status", "price", "publishedAt", "created_at", "id")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'pg_trgm'
        ) THEN
          CREATE INDEX IF NOT EXISTS "IDX_listings_title_trgm"
          ON "listings" USING GIN (LOWER("title") gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_description_trgm"
          ON "listings" USING GIN (LOWER("description") gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_city_trgm"
          ON "listings" USING GIN (LOWER(COALESCE("location"->>'city', '')) gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_address_trgm"
          ON "listings" USING GIN (LOWER(COALESCE("location"->>'address', '')) gin_trgm_ops);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_address_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_city_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_description_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_status_price_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_status_sort"`);
  }
}

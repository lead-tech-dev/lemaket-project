import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchNormalizationFunctions20260406110000 implements MigrationInterface {
  name = 'AddSearchNormalizationFunctions20260406110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_available_extensions
          WHERE name = 'unaccent'
        ) THEN
          CREATE EXTENSION IF NOT EXISTS unaccent;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lemaket_unaccent(input_text text)
      RETURNS text
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE
        output_text text;
      BEGIN
        IF input_text IS NULL THEN
          RETURN '';
        END IF;

        BEGIN
          EXECUTE 'SELECT public.unaccent($1)' INTO output_text USING input_text;
          RETURN COALESCE(output_text, '');
        EXCEPTION
          WHEN undefined_function THEN
            RETURN input_text;
        END;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lemaket_similarity(left_text text, right_text text)
      RETURNS double precision
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
        similarity_score double precision;
      BEGIN
        IF left_text IS NULL OR right_text IS NULL OR right_text = '' THEN
          RETURN 0;
        END IF;

        BEGIN
          EXECUTE 'SELECT similarity($1, $2)' INTO similarity_score USING left_text, right_text;
          RETURN COALESCE(similarity_score, 0);
        EXCEPTION
          WHEN undefined_function THEN
            RETURN 0;
        END;
      END;
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'pg_trgm'
        ) THEN
          CREATE INDEX IF NOT EXISTS "IDX_listings_title_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent("title")) gin_trgm_ops);

          CREATE INDEX IF NOT EXISTS "IDX_listings_description_unaccent_trgm"
          ON "listings" USING GIN (LOWER(lemaket_unaccent("description")) gin_trgm_ops);

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
    await queryRunner.query(`DROP FUNCTION IF EXISTS lemaket_similarity(text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS lemaket_unaccent(text)`);
  }
}

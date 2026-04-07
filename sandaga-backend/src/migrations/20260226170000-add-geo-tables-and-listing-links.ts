import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeoTablesAndListingLinks20260226170000 implements MigrationInterface {
  name = 'AddGeoTablesAndListingLinks20260226170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "geo_cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying(120) NOT NULL,
        "slug" character varying(140) NOT NULL,
        "normalized_name" character varying(160) NOT NULL,
        "region" character varying(120),
        "country_code" character varying(8) NOT NULL DEFAULT 'CM',
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "place_type" character varying(32) NOT NULL DEFAULT 'city',
        "is_active" boolean NOT NULL DEFAULT true,
        "is_popular" boolean NOT NULL DEFAULT false,
        "population" integer,
        CONSTRAINT "PK_geo_cities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_geo_cities_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geo_cities_normalized_name"
      ON "geo_cities" ("normalized_name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geo_cities_popular_active"
      ON "geo_cities" ("is_popular", "is_active")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geo_cities_region"
      ON "geo_cities" ("region")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "geo_neighborhoods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying(120) NOT NULL,
        "slug" character varying(140) NOT NULL,
        "normalized_name" character varying(160) NOT NULL,
        "city_id" uuid NOT NULL,
        "lat" double precision,
        "lng" double precision,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_geo_neighborhoods_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_geo_neighborhoods_city_slug" UNIQUE ("city_id", "slug"),
        CONSTRAINT "FK_geo_neighborhoods_city_id"
          FOREIGN KEY ("city_id")
          REFERENCES "geo_cities" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geo_neighborhoods_normalized_name"
      ON "geo_neighborhoods" ("normalized_name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geo_neighborhoods_city_normalized"
      ON "geo_neighborhoods" ("city_id", "normalized_name")
    `);

    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD COLUMN IF NOT EXISTS "city_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD COLUMN IF NOT EXISTS "neighborhood_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_city_id"
      ON "listings" ("city_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_neighborhood_id"
      ON "listings" ("neighborhood_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD CONSTRAINT "FK_listings_city_id"
      FOREIGN KEY ("city_id")
      REFERENCES "geo_cities" ("id")
      ON DELETE SET NULL
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD CONSTRAINT "FK_listings_neighborhood_id"
      FOREIGN KEY ("neighborhood_id")
      REFERENCES "geo_neighborhoods" ("id")
      ON DELETE SET NULL
    `).catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "FK_listings_neighborhood_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "FK_listings_city_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_neighborhood_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_city_id"`);
    await queryRunner.query(`
      ALTER TABLE "listings" DROP COLUMN IF EXISTS "neighborhood_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "listings" DROP COLUMN IF EXISTS "city_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geo_neighborhoods_city_normalized"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geo_neighborhoods_normalized_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geo_neighborhoods"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geo_cities_region"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geo_cities_popular_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geo_cities_normalized_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geo_cities"`);
  }
}

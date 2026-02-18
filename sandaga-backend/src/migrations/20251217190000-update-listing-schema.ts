import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateListingSchema20251217190000 implements MigrationInterface {
  name = 'UpdateListingSchema20251217190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy collections
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "highlights"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "equipments"`);

    // Flow enum + column
    await queryRunner.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_flow_enum') THEN
          CREATE TYPE "listing_flow_enum" AS ENUM('SELL','BUY');
        END IF;
      END$$;`);
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "flow" "listing_flow_enum" DEFAULT 'SELL'`
    );

    // City no longer stored as a flat column
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "city"`);

    // Convert location (text) -> jsonb { address, city, zipcode, lat, lng }
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "location_tmp" jsonb`);
    await queryRunner.query(`
      UPDATE "listings"
      SET "location_tmp" = CASE
        WHEN pg_typeof("location")::text = 'text'
          THEN jsonb_build_object('address', "location")
        WHEN pg_typeof("location")::text = 'character varying'
          THEN jsonb_build_object('address', "location")
        WHEN pg_typeof("location")::text = 'jsonb'
          THEN ("location")::jsonb
        ELSE '{}'::jsonb
      END
      WHERE "location_tmp" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "location"`);
    await queryRunner.query(`ALTER TABLE "listings" RENAME COLUMN "location_tmp" TO "location"`);

    // Add contact jsonb
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "contact" jsonb DEFAULT '{}'::jsonb`
    );

    // Rename details -> formData
    await queryRunner.query(
      `DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'listings' AND column_name = 'details'
          ) THEN
            ALTER TABLE "listings" RENAME COLUMN "details" TO "formData";
          END IF;
        END$$;`
    );

    // Ensure price is numeric
    await queryRunner.query(
      `ALTER TABLE "listings" ALTER COLUMN "price" TYPE numeric USING ("price"::numeric)`
    );

    // Index on status + flow
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_listings_status_flow" ON "listings" ("status","flow")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listings_status_flow"`);

    // price back to text
    await queryRunner.query(
      `ALTER TABLE "listings" ALTER COLUMN "price" TYPE varchar USING ("price"::varchar)`
    );

    // formData -> details
    await queryRunner.query(
      `DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'listings' AND column_name = 'formData'
          ) THEN
            ALTER TABLE "listings" RENAME COLUMN "formData" TO "details";
          END IF;
        END$$;`
    );

    // Remove contact
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "contact"`);

    // location back to text
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "location_tmp" varchar`);
    await queryRunner.query(`
      UPDATE "listings"
      SET "location_tmp" = COALESCE(
        ("location"->>'address'),
        ("location"->>'city'),
        ("location"->>'zipcode'),
        ''
      )
    `);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "location"`);
    await queryRunner.query(`ALTER TABLE "listings" RENAME COLUMN "location_tmp" TO "location"`);

    // restore city column
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "city" varchar`);

    // drop flow column and enum
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "flow"`);
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_flow_enum') THEN
        DROP TYPE "listing_flow_enum";
      END IF;
    END$$;`);

    // restore highlights/equipments
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "highlights" jsonb DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "equipments" jsonb DEFAULT '[]'::jsonb`
    );
  }
}

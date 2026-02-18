import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlerts20260120160000 implements MigrationInterface {
  name = 'AddAlerts20260120160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alerts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        "user_id" uuid NOT NULL,
        "term" varchar(120),
        "location" varchar(120),
        "seller_type" varchar(20),
        "price_band" varchar(20),
        "radius_km" integer,
        "is_active" boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_alerts_user_created" ON "alerts" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "FK_alerts_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alerts_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alerts"`);
  }
}

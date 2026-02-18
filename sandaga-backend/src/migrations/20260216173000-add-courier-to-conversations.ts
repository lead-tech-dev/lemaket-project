import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourierToConversations20260216173000 implements MigrationInterface {
  name = 'AddCourierToConversations20260216173000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "courier_id" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "courier_id" TYPE uuid USING NULLIF("courier_id"::text, '')::uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unreadCountCourier" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `UPDATE "conversations" SET "unreadCountCourier" = 0 WHERE "unreadCountCourier" IS NULL`
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'conversations_courier_fk'
        ) THEN
          ALTER TABLE "conversations"
          ADD CONSTRAINT "conversations_courier_fk"
          FOREIGN KEY ("courier_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_conversations_courier_id" ON "conversations" ("courier_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_conversations_courier_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_courier_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "unreadCountCourier"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "courier_id"`
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWallets20260213120000 implements MigrationInterface {
  name = 'AddWallets20260213120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "wallet_balance" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "wallet_currency" VARCHAR(3) NOT NULL DEFAULT 'XAF'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "wallet_transaction_type_enum" AS ENUM ('topup','hold','release','refund','withdrawal','adjustment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" "wallet_transaction_type_enum" NOT NULL,
        "amount" NUMERIC(12,2) NOT NULL,
        "currency" VARCHAR(3) NOT NULL DEFAULT 'XAF',
        "status" VARCHAR(12) NOT NULL DEFAULT 'completed',
        "metadata" jsonb,
        CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "wallet_transactions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "wallet_balance", DROP COLUMN IF EXISTS "wallet_currency"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wallet_transaction_type_enum"`);
  }
}

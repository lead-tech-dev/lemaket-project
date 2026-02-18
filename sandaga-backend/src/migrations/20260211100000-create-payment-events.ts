import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentEvents20260211100000 implements MigrationInterface {
  name = 'CreatePaymentEvents20260211100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "payment_id" uuid,
        "provider" VARCHAR,
        "type" VARCHAR NOT NULL,
        "status" VARCHAR,
        "payload" jsonb,
        CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "payment_events_payment_fk" FOREIGN KEY ("payment_id")
          REFERENCES "payments"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_events"`);
  }
}

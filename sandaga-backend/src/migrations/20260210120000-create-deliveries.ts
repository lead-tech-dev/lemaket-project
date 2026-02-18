import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeliveries20260210120000 implements MigrationInterface {
  name = 'CreateDeliveries20260210120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deliveries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "listing_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "courier_id" uuid,
        "status" VARCHAR NOT NULL DEFAULT 'requested',
        "price" NUMERIC(12,2),
        "currency" VARCHAR NOT NULL DEFAULT 'XAF',
        "pickupAddress" TEXT,
        "dropoffAddress" TEXT,
        "dropoffNotes" TEXT,
        "escrow_payment_id" uuid,
        "escrowStatus" VARCHAR NOT NULL DEFAULT 'none',
        "escrowAmount" NUMERIC(12,2),
        "escrowCurrency" VARCHAR NOT NULL DEFAULT 'XAF',
        "pickupLat" double precision,
        "pickupLng" double precision,
        "dropoffLat" double precision,
        "dropoffLng" double precision,
        "acceptedAt" TIMESTAMP,
        "pickedUpAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP,
        "canceledAt" TIMESTAMP,
        "cancelReason" TEXT,
        CONSTRAINT "deliveries_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "deliveries_buyer_fk" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "deliveries_seller_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "deliveries_courier_fk" FOREIGN KEY ("courier_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "deliveries_escrow_fk" FOREIGN KEY ("escrow_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deliveries"`);
  }
}

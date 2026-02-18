import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders20260212103000 implements MigrationInterface {
  name = 'CreateOrders20260212103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "listing_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "delivery_id" uuid,
        "payment_id" uuid,
        "status" VARCHAR NOT NULL DEFAULT 'pending',
        "handover_mode" VARCHAR(12) NOT NULL DEFAULT 'delivery',
        "listingAmount" NUMERIC(12,2) NOT NULL,
        "deliveryAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "platformFee" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "totalAmount" NUMERIC(12,2) NOT NULL,
        "currency" VARCHAR(3) NOT NULL DEFAULT 'XAF',
        "paidAt" TIMESTAMP NULL,
        "completedAt" TIMESTAMP NULL,
        "cancelledAt" TIMESTAMP NULL,
        CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "orders_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "orders_buyer_fk" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "orders_seller_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "orders_delivery_fk" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL,
        CONSTRAINT "orders_payment_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "title" VARCHAR NOT NULL,
        "unitPrice" NUMERIC(12,2) NOT NULL,
        "quantity" INT NOT NULL DEFAULT 1,
        "currency" VARCHAR(3) NOT NULL DEFAULT 'XAF',
        CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "order_items_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "order_items_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUserFollows1770653730492 implements MigrationInterface {
  name = 'CreateUserFollows1770653730492'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "follower_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        CONSTRAINT "PK_user_follows_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_follows_pair" UNIQUE ("follower_id", "seller_id"),
        CONSTRAINT "FK_user_follows_follower" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_follows_seller" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_follows_follower_id" ON "user_follows" ("follower_id")`
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_follows_seller_id" ON "user_follows" ("seller_id")`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_follows_seller_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_follows_follower_id"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_follows"`)
  }
}

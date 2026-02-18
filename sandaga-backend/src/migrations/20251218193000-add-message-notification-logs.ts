import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageNotificationLogs20251218193000 implements MigrationInterface {
  name = 'AddMessageNotificationLogs20251218193000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_notification_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        "message_id" uuid,
        "conversation_id" uuid,
        "recipient_id" uuid,
        "channel" varchar(20) NOT NULL,
        "provider" varchar(20),
        "destination" varchar(255),
        "status" varchar(20) NOT NULL,
        "error" text
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_notification_logs"`);
  }
}

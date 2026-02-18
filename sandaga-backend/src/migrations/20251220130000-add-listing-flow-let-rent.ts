import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddListingFlowLetRent20251220130000 implements MigrationInterface {
  name = 'AddListingFlowLetRent20251220130000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "listings_flow_enum" ADD VALUE IF NOT EXISTS 'LET'`)
    await queryRunner.query(`ALTER TYPE "listings_flow_enum" ADD VALUE IF NOT EXISTS 'RENT'`)
  }

  public async down(): Promise<void> {
    // No-op: enum values cannot be removed safely without recreating the type.
    return
  }
}

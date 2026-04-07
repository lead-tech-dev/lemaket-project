import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchSynonymsTable20260406153000 implements MigrationInterface {
  name = 'AddSearchSynonymsTable20260406153000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_synonyms" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "term" character varying(120) NOT NULL,
        "synonym" character varying(120) NOT NULL,
        "normalizedTerm" character varying(120) NOT NULL,
        "normalizedSynonym" character varying(120) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_search_synonyms_normalized_pair"
          UNIQUE ("normalizedTerm", "normalizedSynonym")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_synonyms_normalized_term"
      ON "search_synonyms" ("normalizedTerm");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_synonyms_normalized_synonym"
      ON "search_synonyms" ("normalizedSynonym");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_synonyms_normalized_synonym"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_search_synonyms_normalized_term"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "search_synonyms"`);
  }
}

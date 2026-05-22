import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingUniqueIndexAndCleanup1716200000000 implements MigrationInterface {
  name = 'AddPendingUniqueIndexAndCleanup1716200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // BUG #9: Prevent duplicate PENDING reservations at DB level.
    // Combined with UQ_active_reservation (reserved), this ensures a user
    // can have at most 1 active/pending reservation per concert.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_pending_reservation"
        ON "reservations" ("user_id", "concert_id")
        WHERE "status" = 'pending'
    `);

    // Add rejected_reason column if not exists (idempotent)
    await queryRunner.query(`
      ALTER TABLE "reservations"
        ADD COLUMN IF NOT EXISTS "rejected_reason" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_pending_reservation"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingRejectedStatus1716100000000 implements MigrationInterface {
  name = 'AddPendingRejectedStatus1716100000000';

  // PostgreSQL requires ALTER TYPE ADD VALUE to be committed
  // before the new value can be used in indexes/queries
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values to reservation_status_enum
    await queryRunner.query(
      `ALTER TYPE "reservation_status_enum" ADD VALUE IF NOT EXISTS 'pending'`,
    );
    await queryRunner.query(
      `COMMIT`,
    );
    await queryRunner.query(
      `ALTER TYPE "reservation_status_enum" ADD VALUE IF NOT EXISTS 'rejected'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // To revert, you would need to recreate the type — left as no-op for safety.
  }
}

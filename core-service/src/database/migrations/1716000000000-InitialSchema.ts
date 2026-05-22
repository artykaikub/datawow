import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1716000000000 implements MigrationInterface {
  name = 'InitialSchema1716000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM('admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "reservation_status_enum" AS ENUM('reserved', 'cancelled')`,
    );

    // Users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "full_name" character varying NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`,
    );

    // Concerts table
    await queryRunner.query(`
      CREATE TABLE "concerts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "total_seats" integer NOT NULL CHECK ("total_seats" >= 1),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concerts" PRIMARY KEY ("id")
      )
    `);

    // Reservations table
    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "concert_id" uuid NOT NULL,
        "status" "reservation_status_enum" NOT NULL DEFAULT 'reserved',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reservations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reservations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reservations_concert" FOREIGN KEY ("concert_id")
          REFERENCES "concerts"("id") ON DELETE CASCADE
      )
    `);

    // Partial unique index: only 1 active reservation per user per concert.
    // Allows re-booking after cancellation (cancelled rows are excluded).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_active_reservation"
        ON "reservations" ("user_id", "concert_id")
        WHERE "status" = 'reserved'
    `);

    // Performance indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_concert_status" ON "reservations" ("concert_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_user" ON "reservations" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reservations_user"`);
    await queryRunner.query(`DROP INDEX "IDX_reservations_concert_status"`);
    await queryRunner.query(`DROP INDEX "UQ_active_reservation"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE "concerts"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "reservation_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}

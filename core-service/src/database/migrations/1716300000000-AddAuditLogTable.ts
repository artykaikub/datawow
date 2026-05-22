import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogTable1716300000000 implements MigrationInterface {
  name = 'AddAuditLogTable1716300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "action" character varying(50) NOT NULL,
        "entity" character varying(50) NOT NULL,
        "entity_id" character varying(255),
        "details" jsonb,
        "performed_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("performed_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_performed_by" ON "audit_logs" ("performed_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_performed_by"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}

/**
 * Supported admin actions for the audit trail.
 * Shared between core-service (producer) and audit-service (consumer).
 * ⚠️  Keep in sync with audit-service/src/entities/audit-log.entity.ts
 */
export enum AuditAction {
  CREATE_CONCERT = 'CREATE_CONCERT',
  DELETE_CONCERT = 'DELETE_CONCERT',
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Retrieve paginated audit logs with performer info (raw join).
   */
  async findAll(page = 1, limit = 50) {
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    // ⚠️  Schema dependency: raw JOIN on core-service's `users` table.
    // If the users table name or columns change, this query breaks silently.
    // TODO: Consider denormalizing performer info into audit_logs at write time
    // for proper microservice isolation.
    const data = await this.auditLogRepo
      .createQueryBuilder('log')
      .leftJoin('users', 'u', 'u.id = log.performed_by')
      .select([
        'log.id AS "id"',
        'log.action AS "action"',
        'log.entity AS "entity"',
        'log.entity_id AS "entityId"',
        'log.details AS "details"',
        'log.performed_by AS "performedBy"',
        'log.created_at AS "createdAt"',
        `jsonb_build_object('id', u.id, 'email', u.email, 'fullName', u.full_name) AS "performer"`,
      ])
      .orderBy('log.created_at', 'DESC')
      .limit(take)
      .offset(skip)
      .getRawMany();

    const total = await this.auditLogRepo.count();

    return { data, total, page, limit: take };
  }
}

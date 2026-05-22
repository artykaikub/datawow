import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaConsumerService, AuditLogMessage, AUDIT_LOG_TOPIC } from './kafka-consumer.service';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogProcessorService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogProcessorService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async onModuleInit() {
    if (!this.kafkaConsumer.isEnabled) {
      this.logger.warn(
        'Kafka disabled — audit log processor will not start',
      );
      return;
    }

    const consumer = await this.kafkaConsumer.createConsumer();

    await consumer.run({
      partitionsConsumedConcurrently: 1,
      eachMessage: async ({ message }) => {
        try {
          const payload: AuditLogMessage = JSON.parse(
            message.value!.toString(),
          );

          const entry = this.auditLogRepo.create({
            action: payload.action as AuditAction,
            entity: payload.entity,
            entityId: payload.entityId,
            details: payload.details,
            performedBy: payload.performedBy,
          });

          await this.auditLogRepo.save(entry);

          this.logger.log(
            `Audit log saved: ${payload.action} on ${payload.entity}(${payload.entityId}) by ${payload.performedBy}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process audit log message: ${error}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      },
    });

    this.logger.log(
      `Audit log processor started — consuming from Kafka topic "${AUDIT_LOG_TOPIC}"`,
    );
  }
}

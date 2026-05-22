import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaConsumerService } from './kafka-consumer.service';
import { AuditLogProcessorService } from './audit-log-processor.service';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [KafkaConsumerService, AuditLogProcessorService],
  exports: [KafkaConsumerService],
})
export class KafkaModule {}

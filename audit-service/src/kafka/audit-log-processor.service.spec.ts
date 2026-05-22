import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogProcessorService } from './audit-log-processor.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditLogProcessorService', () => {
  let service: AuditLogProcessorService;
  let kafkaConsumer: { isEnabled: boolean; createConsumer: jest.Mock };
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    kafkaConsumer = {
      isEnabled: false,
      createConsumer: jest.fn(),
    };

    repo = {
      create: jest.fn((data) => data),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogProcessorService,
        { provide: KafkaConsumerService, useValue: kafkaConsumer },
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditLogProcessorService>(AuditLogProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip init when Kafka is disabled', async () => {
    kafkaConsumer.isEnabled = false;
    await service.onModuleInit();
    expect(kafkaConsumer.createConsumer).not.toHaveBeenCalled();
  });

  it('should create consumer when Kafka is enabled', async () => {
    kafkaConsumer.isEnabled = true;
    const mockConsumer = { run: jest.fn() };
    kafkaConsumer.createConsumer.mockResolvedValue(mockConsumer);

    await service.onModuleInit();

    expect(kafkaConsumer.createConsumer).toHaveBeenCalled();
    expect(mockConsumer.run).toHaveBeenCalledWith(
      expect.objectContaining({ partitionsConsumedConcurrently: 1 }),
    );
  });
});

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, logLevel, SASLOptions } from 'kafkajs';

/** ⚠️  Keep in sync with core-service/src/common/constants.ts */
export const AUDIT_LOG_TOPIC = 'audit.log';
export const AUDIT_CONSUMER_GROUP_ID = 'datawow-audit-processor';

/**
 * Audit log message consumed from Kafka.
 * ⚠️  Keep in sync with core-service/src/kafka/kafka.service.ts
 */
export interface AuditLogMessage {
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  performedBy: string;
  timestamp: string;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private readonly enabled: boolean;
  private readonly broker: string;

  constructor(private readonly configService: ConfigService) {
    this.broker = this.configService.get<string>('KAFKA_BROKER', '');
    this.enabled = !!this.broker;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn(
        'KAFKA_BROKER not set — audit log processor will not start',
      );
      return;
    }

    const kafkaConfig: ConstructorParameters<typeof Kafka>[0] = {
      clientId: 'datawow-audit-service',
      brokers: [this.broker],
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 1000,
        retries: 5,
      },
    };

    // Optional SASL/SSL
    const sslEnabled = this.configService.get<string>('KAFKA_SSL') === 'true';
    if (sslEnabled) {
      kafkaConfig.ssl = true;
    }

    const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
    const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');
    if (saslUsername && saslPassword) {
      kafkaConfig.ssl = kafkaConfig.ssl ?? true;
      kafkaConfig.sasl = {
        mechanism: this.configService.get<string>('KAFKA_SASL_MECHANISM', 'plain') as SASLOptions['mechanism'],
        username: saslUsername,
        password: saslPassword,
      } as SASLOptions;
    }

    this.kafka = new Kafka(kafkaConfig);
    this.logger.log(`Kafka consumer service initialized (broker: ${this.broker})`);
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  /**
   * Create a consumer subscribed to the audit.log topic.
   */
  async createConsumer(): Promise<Consumer> {
    if (!this.kafka) {
      throw new Error('Kafka client not initialized');
    }

    this.consumer = this.kafka.consumer({
      groupId: AUDIT_CONSUMER_GROUP_ID,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: AUDIT_LOG_TOPIC,
      fromBeginning: false,
    });

    this.logger.log(
      `Kafka audit consumer connected (group: ${AUDIT_CONSUMER_GROUP_ID})`,
    );

    return this.consumer;
  }
}

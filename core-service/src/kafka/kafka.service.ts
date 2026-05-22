import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, Admin, logLevel, SASLOptions, IHeaders } from 'kafkajs';
import { RESERVATION_DLQ_TOPIC, AUDIT_LOG_TOPIC } from '../common/constants';

export const RESERVATION_TOPIC = 'reservation.requested';
export const CONSUMER_GROUP_ID = 'datawow-reservation-processor';

export interface ReservationMessage {
  reservationId: string;
  userId: string;
  concertId: string;
  action: 'reserve' | 'cancel';
}

/**
 * Audit log message published to Kafka.
 * ⚠️  Keep in sync with audit-service/src/kafka/kafka-consumer.service.ts
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
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumers: Consumer[] = [];
  private admin: Admin | null = null;
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
        'KAFKA_BROKER not set — falling back to synchronous reservation processing',
      );
      return;
    }

    // H-6: Build Kafka config with optional SASL/SSL for production
    const kafkaConfig: ConstructorParameters<typeof Kafka>[0] = {
      clientId: 'datawow-concert-api',
      brokers: [this.broker],
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 1000,
        retries: 5,
      },
    };

    // Enable SSL if KAFKA_SSL=true
    const sslEnabled = this.configService.get<string>('KAFKA_SSL') === 'true';
    if (sslEnabled) {
      kafkaConfig.ssl = true;
    }

    // Enable SASL auth if KAFKA_SASL_USERNAME is set
    const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
    const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');
    if (saslUsername && saslPassword) {
      kafkaConfig.ssl = kafkaConfig.ssl ?? true; // SASL requires SSL
      kafkaConfig.sasl = {
        mechanism: this.configService.get<string>('KAFKA_SASL_MECHANISM', 'plain') as SASLOptions['mechanism'],
        username: saslUsername,
        password: saslPassword,
      } as SASLOptions;
      this.logger.log('Kafka SASL authentication enabled');
    }

    this.kafka = new Kafka(kafkaConfig);

    // Create topic if not exists
    this.admin = this.kafka.admin();
    await this.admin.connect();
    const topics = await this.admin.listTopics();

    if (!topics.includes(RESERVATION_TOPIC)) {
      await this.admin.createTopics({
        topics: [
          {
            topic: RESERVATION_TOPIC,
            numPartitions: 6,
            replicationFactor: 1,
          },
        ],
      });
      this.logger.log(
        `Created Kafka topic "${RESERVATION_TOPIC}" with 6 partitions`,
      );
    }

    if (!topics.includes(AUDIT_LOG_TOPIC)) {
      await this.admin.createTopics({
        topics: [
          {
            topic: AUDIT_LOG_TOPIC,
            numPartitions: 1,
            replicationFactor: 1,
          },
        ],
      });
      this.logger.log(`Created Kafka topic "${AUDIT_LOG_TOPIC}"`);
    }

    await this.admin.disconnect();

    // Connect producer
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.log(`Kafka producer connected to ${this.broker}`);
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
    }
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }

  /**
   * Publish a reservation request to Kafka.
   * Messages are partitioned by concertId — all requests for the same concert
   * go to the same partition → processed in order → no race conditions.
   * B-H2: Supports retry count via message headers.
   */
  async publishReservationRequest(message: ReservationMessage, retryCount = 0): Promise<void> {
    if (!this.producer) {
      throw new Error('Kafka producer not initialized');
    }

    const headers: IHeaders = {};
    if (retryCount > 0) {
      headers['x-retry-count'] = Buffer.from(String(retryCount));
    }

    await this.producer.send({
      topic: RESERVATION_TOPIC,
      messages: [
        {
          // Key = concertId → same concert always goes to same partition
          key: message.concertId,
          value: JSON.stringify(message),
          headers,
        },
      ],
    });

    this.logger.debug(
      `Published ${message.action} request for reservation ${message.reservationId} to Kafka (retry=${retryCount})`,
    );
  }

  /**
   * Publish an audit log event to Kafka.
   * Non-blocking: audit logging should never fail the main operation.
   */
  async publishAuditLog(message: AuditLogMessage): Promise<void> {
    if (!this.producer) {
      this.logger.warn('Kafka producer not initialized — audit log dropped');
      return;
    }

    try {
      await this.producer.send({
        topic: AUDIT_LOG_TOPIC,
        messages: [
          {
            key: message.performedBy,
            value: JSON.stringify(message),
          },
        ],
      });

      this.logger.debug(
        `Published audit log: ${message.action} on ${message.entity}(${message.entityId})`,
      );
    } catch (err) {
      this.logger.error('Failed to publish audit log to Kafka', err);
    }
  }

  /**
   * B-H2: Publish failed message to Dead Letter Queue.
   */
  async publishToDLQ(
    message: ReservationMessage,
    retryCount: number,
    errorMessage: string,
  ): Promise<void> {
    if (!this.producer) {
      this.logger.error('Cannot publish to DLQ — producer not initialized');
      return;
    }

    await this.producer.send({
      topic: RESERVATION_DLQ_TOPIC,
      messages: [
        {
          key: message.concertId,
          value: JSON.stringify({
            ...message,
            failedAt: new Date().toISOString(),
            retryCount,
            errorMessage,
          }),
        },
      ],
    });

    this.logger.warn(
      `Message sent to DLQ: reservation=${message.reservationId} error=${errorMessage}`,
    );
  }

  /**
   * Create a consumer and subscribe to the reservation topic.
   * Returns the consumer instance for the processor to use.
   */
  async createConsumer(): Promise<Consumer> {
    if (!this.kafka) {
      throw new Error('Kafka client not initialized');
    }

    const consumer = this.kafka.consumer({
      groupId: CONSUMER_GROUP_ID,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: RESERVATION_TOPIC,
      fromBeginning: false,
    });

    this.consumers.push(consumer);
    this.logger.log(
      `Kafka consumer connected (group: ${CONSUMER_GROUP_ID})`,
    );

    return consumer;
  }
}

import { ConfigService } from '@nestjs/config';
import { KafkaService, RESERVATION_TOPIC, CONSUMER_GROUP_ID, ReservationMessage } from './kafka.service';

describe('KafkaService', () => {
  let service: KafkaService;
  let configService: Partial<ConfigService>;

  const sampleMessage: ReservationMessage = {
    reservationId: 'res-1',
    userId: 'user-1',
    concertId: 'concert-1',
    action: 'reserve',
  };

  describe('when KAFKA_BROKER is not set', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockReturnValue(''),
      };
      service = new KafkaService(configService as ConfigService);
    });

    it('should be disabled', () => {
      expect(service.isEnabled).toBe(false);
    });

    it('should not throw on onModuleInit', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should not throw on onModuleDestroy', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('publishReservationRequest should throw when producer not initialized', async () => {
      await expect(service.publishReservationRequest(sampleMessage)).rejects.toThrow(
        'Kafka producer not initialized',
      );
    });

    it('publishToDLQ should not throw when producer not initialized (logs error)', async () => {
      await expect(
        service.publishToDLQ(sampleMessage, 3, 'some error'),
      ).resolves.not.toThrow();
    });

    it('createConsumer should throw when client not initialized', async () => {
      await expect(service.createConsumer()).rejects.toThrow(
        'Kafka client not initialized',
      );
    });
  });

  describe('when KAFKA_BROKER is set', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockReturnValue('localhost:9092'),
      };
      service = new KafkaService(configService as ConfigService);
    });

    it('should be enabled', () => {
      expect(service.isEnabled).toBe(true);
    });

    it('should throw when publishing without initialization', async () => {
      await expect(service.publishReservationRequest(sampleMessage)).rejects.toThrow(
        'Kafka producer not initialized',
      );
    });

    it('should throw when creating consumer without initialization', async () => {
      await expect(service.createConsumer()).rejects.toThrow(
        'Kafka client not initialized',
      );
    });

    describe('with mocked producer', () => {
      let mockProducer: { send: jest.Mock; connect: jest.Mock; disconnect: jest.Mock };

      beforeEach(() => {
        mockProducer = {
          send: jest.fn().mockResolvedValue(undefined),
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
        };
        // Inject mock producer via reflection
        (service as any).producer = mockProducer;
      });

      it('publishReservationRequest should send message without retry headers by default', async () => {
        await service.publishReservationRequest(sampleMessage);

        expect(mockProducer.send).toHaveBeenCalledWith({
          topic: RESERVATION_TOPIC,
          messages: [
            {
              key: 'concert-1',
              value: JSON.stringify(sampleMessage),
              headers: {},
            },
          ],
        });
      });

      it('publishReservationRequest should include x-retry-count header when retryCount > 0', async () => {
        await service.publishReservationRequest(sampleMessage, 3);

        expect(mockProducer.send).toHaveBeenCalledWith({
          topic: RESERVATION_TOPIC,
          messages: [
            {
              key: 'concert-1',
              value: JSON.stringify(sampleMessage),
              headers: {
                'x-retry-count': Buffer.from('3'),
              },
            },
          ],
        });
      });

      it('publishToDLQ should send message to DLQ topic', async () => {
        await service.publishToDLQ(sampleMessage, 5, 'max retries exceeded');

        expect(mockProducer.send).toHaveBeenCalledWith({
          topic: 'reservation.dlq',
          messages: [
            expect.objectContaining({
              key: 'concert-1',
            }),
          ],
        });

        // Verify DLQ payload contains error info
        const sentValue = JSON.parse(mockProducer.send.mock.calls[0][0].messages[0].value);
        expect(sentValue.reservationId).toBe('res-1');
        expect(sentValue.retryCount).toBe(5);
        expect(sentValue.errorMessage).toBe('max retries exceeded');
        expect(sentValue.failedAt).toBeDefined();
      });

      it('onModuleDestroy should disconnect producer', async () => {
        await service.onModuleDestroy();
        expect(mockProducer.disconnect).toHaveBeenCalled();
      });

      it('onModuleDestroy should disconnect consumers if exist', async () => {
        const mockConsumer = { disconnect: jest.fn().mockResolvedValue(undefined) };
        (service as any).consumers = [mockConsumer];

        await service.onModuleDestroy();

        expect(mockProducer.disconnect).toHaveBeenCalled();
        expect(mockConsumer.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('constants', () => {
    it('should export correct topic name', () => {
      expect(RESERVATION_TOPIC).toBe('reservation.requested');
    });

    it('should export correct consumer group ID', () => {
      expect(CONSUMER_GROUP_ID).toBe('datawow-reservation-processor');
    });
  });
});

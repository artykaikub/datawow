import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { ReservationProcessorService } from './reservation-processor.service';
import { KafkaService } from './kafka.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';
import { SeatCounterService } from '../redis/seat-counter.service';

describe('ReservationProcessorService', () => {
  let processor: ReservationProcessorService;
  let reservationRepo: Record<string, jest.Mock>;
  let kafkaService: Record<string, jest.Mock | boolean>;

  const mockManager = {
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
      cb(mockManager),
    ),
  };

  beforeEach(async () => {
    reservationRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    kafkaService = {
      isEnabled: false, // Disabled so onModuleInit doesn't try to connect
      createConsumer: jest.fn(),
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationProcessorService,
        { provide: KafkaService, useValue: kafkaService },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: CACHE_MANAGER,
          useValue: {
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SeatCounterService,
          useValue: {
            isEnabled: false,
            tryDecrement: jest.fn().mockResolvedValue(null),
            increment: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    processor = module.get<ReservationProcessorService>(
      ReservationProcessorService,
    );
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should not start consumer when Kafka is disabled', async () => {
    await processor.onModuleInit();
    expect(kafkaService.createConsumer).not.toHaveBeenCalled();
  });

  describe('processReservation (via reflection)', () => {
    it('should confirm reservation when seats are available', async () => {
      const mockConcert = { id: 'c-1', name: 'Test', totalSeats: 100 };

      mockManager.findOne
        .mockResolvedValueOnce(mockConcert) // concert with lock
        .mockResolvedValueOnce(null); // no existing reservation
      mockManager.count.mockResolvedValue(50); // 50 reserved
      mockManager.update.mockResolvedValue({ affected: 1 });

      // Call private method via bracket notation
      await (processor as any).processReservation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'reserve',
      });

      expect(mockManager.update).toHaveBeenCalledWith(
        Reservation,
        'res-1',
        { status: ReservationStatus.RESERVED },
      );
    });

    it('should reject reservation when concert not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await (processor as any).processReservation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'bad-id',
        action: 'reserve',
      });

      expect(reservationRepo.update).toHaveBeenCalledWith('res-1', {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'Concert not found',
      });
    });

    it('should reject reservation when no seats available', async () => {
      const mockConcert = { id: 'c-1', name: 'Test', totalSeats: 10 };

      mockManager.findOne
        .mockResolvedValueOnce(mockConcert)
        .mockResolvedValueOnce(null); // no duplicate
      mockManager.count.mockResolvedValue(10); // all seats taken

      await (processor as any).processReservation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'reserve',
      });

      expect(reservationRepo.update).toHaveBeenCalledWith('res-1', {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'No seats available for this concert',
      });
    });

    it('should reject reservation when user already has one', async () => {
      const mockConcert = { id: 'c-1', name: 'Test', totalSeats: 100 };

      mockManager.findOne
        .mockResolvedValueOnce(mockConcert)
        .mockResolvedValueOnce({ id: 'existing-res' }); // duplicate

      await (processor as any).processReservation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'reserve',
      });

      expect(reservationRepo.update).toHaveBeenCalledWith('res-1', {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'You already have a reservation for this concert',
      });
    });
  });

  describe('processCancellation (via reflection)', () => {
    it('should cancel an active reservation atomically', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 1 });

      await (processor as any).processCancellation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'cancel',
      });

      expect(reservationRepo.update).toHaveBeenCalledWith(
        {
          id: 'res-1',
          userId: 'user-1',
          status: ReservationStatus.RESERVED,
        },
        {
          status: ReservationStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      );
    });

    it('should increment seat counter after successful cancel', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 1 });
      const seatCounter = (processor as any).seatCounter;

      await (processor as any).processCancellation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'cancel',
      });

      expect(seatCounter.increment).toHaveBeenCalledWith('c-1');
    });

    it('should NOT increment seat counter when no reservation found', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 0 });
      const seatCounter = (processor as any).seatCounter;

      await (processor as any).processCancellation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'cancel',
      });

      expect(seatCounter.increment).not.toHaveBeenCalled();
    });
  });

  describe('processReservation — duplicate pending detection', () => {
    it('should reject when another PENDING reservation exists for same user+concert', async () => {
      const mockConcert = { id: 'c-1', name: 'Test', totalSeats: 100 };

      mockManager.findOne
        .mockResolvedValueOnce(mockConcert)  // concert
        .mockResolvedValueOnce(null)          // no existing RESERVED
        .mockResolvedValueOnce({ id: 'other-pending' }); // other PENDING exists

      await (processor as any).processReservation({
        reservationId: 'res-1',
        userId: 'user-1',
        concertId: 'c-1',
        action: 'reserve',
      });

      expect(reservationRepo.update).toHaveBeenCalledWith('res-1', {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'Duplicate reservation detected',
      });
    });
  });

  describe('processReservation — DB transaction failure', () => {
    it('should reject reservation and increment counter back on DB error', async () => {
      const dbError = new Error('DB connection lost');
      (mockDataSource.transaction as jest.Mock).mockRejectedValueOnce(dbError);

      const seatCounter = (processor as any).seatCounter;

      await expect(
        (processor as any).processReservation({
          reservationId: 'res-1',
          userId: 'user-1',
          concertId: 'c-1',
          action: 'reserve',
        }),
      ).rejects.toThrow('DB connection lost');

      // Should rollback Redis counter
      expect(seatCounter.increment).toHaveBeenCalledWith('c-1');
      // Should reject the reservation
      expect(reservationRepo.update).toHaveBeenCalledWith('res-1', {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'Internal processing error',
      });
    });
  });

  describe('onModuleInit — consumer setup', () => {
    it('should start consumer when Kafka is enabled', async () => {
      kafkaService.isEnabled = true;
      const mockConsumer = {
        run: jest.fn().mockResolvedValue(undefined),
      };
      (kafkaService.createConsumer as jest.Mock).mockResolvedValue(mockConsumer);

      await processor.onModuleInit();

      expect(kafkaService.createConsumer).toHaveBeenCalled();
      expect(mockConsumer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionsConsumedConcurrently: 1,
          eachMessage: expect.any(Function),
        }),
      );
    });
  });
});

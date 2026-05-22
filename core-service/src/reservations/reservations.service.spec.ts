import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';
import { KafkaService } from '../kafka/kafka.service';
import { SeatCounterService } from '../redis/seat-counter.service';
import { AppException } from '../common/app-exception';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepo: Record<string, jest.Mock>;
  let concertRepo: Record<string, jest.Mock>;
  let kafkaService: Record<string, jest.Mock | boolean>;

  // Mock entity manager used inside transactions
  const mockManager = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
      cb(mockManager),
    ),
  };

  /**
   * Helper: create test module with specified Kafka enabled state.
   */
  async function createTestModule(kafkaEnabled: boolean) {
    reservationRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    concertRepo = {
      findOne: jest.fn(),
    };

    kafkaService = {
      isEnabled: kafkaEnabled,
      publishReservationRequest: jest.fn().mockResolvedValue(undefined),
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Concert), useValue: concertRepo },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: KafkaService, useValue: kafkaService },
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

    service = module.get<ReservationsService>(ReservationsService);
  }

  // ─── Synchronous mode (Kafka disabled) ───
  describe('reserve (synchronous / Kafka disabled)', () => {
    const userId = 'user-1';
    const concertId = 'concert-1';
    const mockConcert = { id: concertId, name: 'Test', totalSeats: 100 };

    beforeEach(() => createTestModule(false));

    it('should create a reservation successfully via direct DB', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockConcert) // concert lookup
        .mockResolvedValueOnce(null); // no existing reservation
      mockManager.count.mockResolvedValue(50);
      mockManager.create.mockReturnValue({
        userId,
        concertId,
        status: ReservationStatus.RESERVED,
      });
      mockManager.save.mockResolvedValue({
        id: 'res-1',
        userId,
        concertId,
        status: ReservationStatus.RESERVED,
      });

      const result = await service.reserve(userId, concertId);

      expect(result.status).toBe(ReservationStatus.RESERVED);
      expect(mockManager.findOne).toHaveBeenCalledTimes(2);
      expect(kafkaService.publishReservationRequest).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if concert does not exist', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should throw ConflictException if already reserved', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockConcert)
        .mockResolvedValueOnce({ id: 'existing-res' });

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should throw BadRequestException when concert is fully booked', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockConcert, totalSeats: 10 })
        .mockResolvedValueOnce(null);
      mockManager.count.mockResolvedValue(10);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });
  });

  // ─── Kafka mode (Kafka enabled) ───
  describe('reserve (Kafka mode)', () => {
    const userId = 'user-1';
    const concertId = 'concert-1';
    const mockConcert = { id: concertId, name: 'Test', totalSeats: 100 };

    beforeEach(() => createTestModule(true));

    it('should create a PENDING reservation and publish to Kafka', async () => {
      concertRepo.findOne.mockResolvedValue(mockConcert);
      reservationRepo.findOne.mockResolvedValue(null); // no existing
      reservationRepo.create.mockReturnValue({
        userId,
        concertId,
        status: ReservationStatus.PENDING,
      });
      reservationRepo.save.mockResolvedValue({
        id: 'res-1',
        userId,
        concertId,
        status: ReservationStatus.PENDING,
      });

      const result = await service.reserve(userId, concertId);

      expect(result.status).toBe(ReservationStatus.PENDING);
      expect((result as any).message).toBe('Reservation is being processed');
      expect(kafkaService.publishReservationRequest).toHaveBeenCalledWith({
        reservationId: 'res-1',
        userId,
        concertId,
        action: 'reserve',
      });
    });

    it('should throw NotFoundException if concert not found', async () => {
      concertRepo.findOne.mockResolvedValue(null);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should throw ConflictException if user already has active/pending reservation', async () => {
      concertRepo.findOne.mockResolvedValue(mockConcert);
      reservationRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: ReservationStatus.RESERVED,
      });

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });
  });

  // ─── Cancel ───
  describe('cancel', () => {
    beforeEach(() => createTestModule(false));

    it('should cancel a reservation atomically', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.cancel('user-1', 'concert-1');

      expect(result.message).toBe('Reservation cancelled successfully');
      expect(result.affected).toBe(1);
      expect(reservationRepo.update).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          concertId: 'concert-1',
          status: ReservationStatus.RESERVED,
        },
        {
          status: ReservationStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      );
    });

    it('should throw NotFoundException if no active reservation', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.cancel('user-1', 'concert-1')).rejects.toThrow(
        AppException,
      );
    });

    it('should increment Redis counter on successful cancel', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 1 });
      const seatCounter = (service as any).seatCounter;

      await service.cancel('user-1', 'concert-1');

      expect(seatCounter.increment).toHaveBeenCalledWith('concert-1');
    });

    it('should invalidate concert list cache on successful cancel', async () => {
      reservationRepo.update.mockResolvedValue({ affected: 1 });
      const cacheManager = (service as any).cacheManager;

      await service.cancel('user-1', 'concert-1');

      expect(cacheManager.del).toHaveBeenCalledWith('concerts:list');
    });
  });

  // ─── Direct reserve — Redis precheck ───
  describe('reserve (direct) — Redis precheck scenarios', () => {
    const userId = 'user-1';
    const concertId = 'concert-1';

    beforeEach(async () => {
      await createTestModule(false);
    });

    it('should throw BadRequestException when Redis counter shows no seats', async () => {
      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(-1);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should rollback Redis counter when DB transaction fails', async () => {
      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(49); // decremented OK

      mockManager.findOne.mockResolvedValueOnce(null); // concert not found in transaction

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );

      // Redis counter should be incremented back
      expect(seatCounter.increment).toHaveBeenCalledWith(concertId);
    });

    it('should rollback Redis counter when concert is fully booked in DB', async () => {
      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(0);

      mockManager.findOne
        .mockResolvedValueOnce({ id: concertId, totalSeats: 10 })
        .mockResolvedValueOnce(null); // no existing reservation
      mockManager.count.mockResolvedValue(10); // all seats taken

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );

      expect(seatCounter.increment).toHaveBeenCalledWith(concertId);
    });
  });

  // ─── Kafka reserve — additional edge cases ───
  describe('reserve (Kafka) — edge cases', () => {
    const userId = 'user-1';
    const concertId = 'concert-1';

    beforeEach(() => createTestModule(true));

    it('should throw ConflictException with PENDING message when existing is pending', async () => {
      concertRepo.findOne.mockResolvedValue({ id: concertId, totalSeats: 100 });
      reservationRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: ReservationStatus.PENDING,
      });

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should throw BadRequestException when Redis counter shows no seats', async () => {
      concertRepo.findOne.mockResolvedValue({ id: concertId, totalSeats: 100 });
      reservationRepo.findOne.mockResolvedValue(null);

      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(-1);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );
    });

    it('should rollback Redis counter when save fails', async () => {
      concertRepo.findOne.mockResolvedValue({ id: concertId, totalSeats: 100 });
      reservationRepo.findOne.mockResolvedValue(null);
      reservationRepo.create.mockReturnValue({ userId, concertId, status: ReservationStatus.PENDING });
      reservationRepo.save.mockRejectedValue(new Error('DB save failed'));

      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(49);

      await expect(service.reserve(userId, concertId)).rejects.toThrow('DB save failed');

      expect(seatCounter.increment).toHaveBeenCalledWith(concertId);
    });

    it('should throw ConflictException on unique constraint violation', async () => {
      concertRepo.findOne.mockResolvedValue({ id: concertId, totalSeats: 100 });
      reservationRepo.findOne.mockResolvedValue(null);
      reservationRepo.create.mockReturnValue({ userId, concertId, status: ReservationStatus.PENDING });

      // Simulate PG unique constraint violation
      const pgError = new Error('unique_violation') as Error & { code?: string };
      pgError.code = '23505';
      reservationRepo.save.mockRejectedValue(pgError);

      const seatCounter = (service as any).seatCounter;
      seatCounter.tryDecrement = jest.fn().mockResolvedValue(49);

      await expect(service.reserve(userId, concertId)).rejects.toThrow(
        AppException,
      );

      // Redis counter should be rolled back
      expect(seatCounter.increment).toHaveBeenCalledWith(concertId);
    });
  });

  // ─── History ───
  describe('getMyHistory', () => {
    beforeEach(() => createTestModule(false));

    it('should return user reservation history', async () => {
      const mockHistory = [
        { id: 'res-1', status: ReservationStatus.RESERVED },
        { id: 'res-2', status: ReservationStatus.CANCELLED },
      ];

      reservationRepo.find.mockResolvedValue(mockHistory);

      const result = await service.getMyHistory('user-1');

      expect(result).toHaveLength(2);
      expect(reservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('should include concert relation and proper select fields', async () => {
      reservationRepo.find.mockResolvedValue([]);

      await service.getMyHistory('user-1');

      expect(reservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['concert'],
          order: { createdAt: 'DESC' },
          select: expect.objectContaining({
            id: true,
            status: true,
            rejectedReason: true,
          }),
        }),
      );
    });
  });
});

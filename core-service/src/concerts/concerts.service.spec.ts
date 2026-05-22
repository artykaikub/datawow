import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConcertsService } from './concerts.service';
import { Concert } from '../entities/concert.entity';
import { Reservation } from '../entities/reservation.entity';
import { SeatCounterService } from '../redis/seat-counter.service';
import { KafkaService } from '../kafka/kafka.service';
import { AppException } from '../common/app-exception';

describe('ConcertsService', () => {
  let service: ConcertsService;
  let concertRepo: Record<string, jest.Mock>;
  let reservationRepo: Record<string, jest.Mock>;

  // Mock query builder chain
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    concertRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    reservationRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcertsService,
        { provide: getRepositoryToken(Concert), useValue: concertRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SeatCounterService,
          useValue: {
            isEnabled: false,
            initCounter: jest.fn().mockResolvedValue(undefined),
            deleteCounter: jest.fn().mockResolvedValue(undefined),
            getAvailableBatch: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            isEnabled: false,
            publishAuditLog: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ConcertsService>(ConcertsService);
  });

  describe('create', () => {
    it('should create and return a concert', async () => {
      const dto = {
        name: 'Test Concert',
        description: 'Great show',
        totalSeats: 500,
      };
      const concert = { id: 'uuid-1', ...dto };

      concertRepo.create.mockReturnValue(concert);
      concertRepo.save.mockResolvedValue(concert);

      const result = await service.create(dto);

      expect(result.name).toBe('Test Concert');
      expect(result.totalSeats).toBe(500);
      expect(concertRepo.create).toHaveBeenCalledWith(dto);
      expect(concertRepo.save).toHaveBeenCalledWith(concert);
    });
  });

  describe('findAll', () => {
    it('should return concerts enriched with stats', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 'c-1',
          name: 'Concert 1',
          description: 'Desc',
          totalSeats: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          reservedSeats: 30,
          cancelledSeats: 5,
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].reservedSeats).toBe(30);
      expect(result[0].availableSeats).toBe(70);
      expect(concertRepo.createQueryBuilder).toHaveBeenCalledWith('c');
    });

    it('should return empty array when no concerts', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a concert by id', async () => {
      const concert = { id: 'c-1', name: 'Test' };
      concertRepo.findOne.mockResolvedValue(concert);

      const result = await service.findOne('c-1');

      expect(result.name).toBe('Test');
      expect(concertRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      concertRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an existing concert', async () => {
      const concert = { id: 'c-1', name: 'Test' };
      concertRepo.findOne.mockResolvedValue(concert);
      concertRepo.remove.mockResolvedValue(concert);

      await service.remove('c-1');

      expect(concertRepo.remove).toHaveBeenCalledWith(concert);
    });

    it('should throw NotFoundException if concert not found', async () => {
      concertRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(
        AppException,
      );
    });
  });


  describe('findAll — cache behavior', () => {
    it('should return cached data when cache hit', async () => {
      const cachedConcerts = [
        {
          id: 'c-1',
          name: 'Cached Concert',
          totalSeats: 100,
          reservedSeats: 30,
          cancelledSeats: 5,
          availableSeats: 70,
        },
      ];

      const cacheManager = (service as any).cacheManager;
      cacheManager.get = jest.fn().mockResolvedValue(cachedConcerts);

      const result = await service.findAll();

      expect(result).toEqual(cachedConcerts);
      // Should NOT hit DB
      expect(concertRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should cache data on DB query (cache miss)', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 'c-1',
          name: 'Concert 1',
          description: 'Desc',
          totalSeats: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          reservedSeats: 30,
          cancelledSeats: 5,
        },
      ]);

      const cacheManager = (service as any).cacheManager;

      const result = await service.findAll();

      expect(cacheManager.set).toHaveBeenCalledWith(
        'concerts:list',
        expect.any(Array),
        30_000,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findAll — Redis overlay', () => {
    it('should overlay real-time Redis counts when seat counter is enabled', async () => {
      const seatCounter = (service as any).seatCounter;
      seatCounter.isEnabled = true;
      seatCounter.getAvailableBatch = jest.fn().mockResolvedValue(
        new Map([['c-1', 65]]),
      );

      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 'c-1',
          name: 'Concert 1',
          description: 'Desc',
          totalSeats: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          reservedSeats: 30,
          cancelledSeats: 5,
        },
      ]);

      const result = await service.findAll();

      expect(result[0].availableSeats).toBe(65); // from Redis, not DB
      expect(result[0].reservedSeats).toBe(35); // totalSeats - redisCount
    });

    it('should call initCounterIfMissing when Redis has no counter for a concert', async () => {
      const seatCounter = (service as any).seatCounter;
      seatCounter.isEnabled = true;
      seatCounter.getAvailableBatch = jest.fn().mockResolvedValue(new Map()); // no counters
      seatCounter.initCounterIfMissing = jest.fn().mockResolvedValue(undefined);

      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 'c-1',
          name: 'Concert 1',
          description: 'Desc',
          totalSeats: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          reservedSeats: 30,
          cancelledSeats: 5,
        },
      ]);

      await service.findAll();

      expect(seatCounter.initCounterIfMissing).toHaveBeenCalledWith('c-1', 70); // 100-30
    });
  });

  describe('create — cache invalidation', () => {
    it('should invalidate concert list cache after creation', async () => {
      const dto = {
        name: 'New Concert',
        description: 'Great show',
        totalSeats: 200,
      };
      const concert = { id: 'uuid-2', ...dto };

      concertRepo.create.mockReturnValue(concert);
      concertRepo.save.mockResolvedValue(concert);

      const cacheManager = (service as any).cacheManager;

      await service.create(dto);

      expect(cacheManager.del).toHaveBeenCalledWith('concerts:list');
    });
  });

  describe('remove — cleanup', () => {
    it('should delete Redis counter and invalidate cache on remove', async () => {
      const concert = { id: 'c-1', name: 'Test' };
      concertRepo.findOne.mockResolvedValue(concert);
      concertRepo.remove.mockResolvedValue(concert);

      const seatCounter = (service as any).seatCounter;
      const cacheManager = (service as any).cacheManager;

      await service.remove('c-1');

      expect(seatCounter.deleteCounter).toHaveBeenCalledWith('c-1');
      expect(cacheManager.del).toHaveBeenCalledWith('concerts:list');
    });
  });
});

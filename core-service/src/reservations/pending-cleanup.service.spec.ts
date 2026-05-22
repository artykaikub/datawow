import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PendingCleanupService } from './pending-cleanup.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { SeatCounterService } from '../redis/seat-counter.service';

describe('PendingCleanupService', () => {
  let service: PendingCleanupService;
  let reservationRepo: Record<string, jest.Mock>;
  let seatCounter: Record<string, jest.Mock>;

  beforeEach(async () => {
    reservationRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };

    seatCounter = {
      increment: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PendingCleanupService,
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: SeatCounterService, useValue: seatCounter },
      ],
    }).compile();

    service = module.get<PendingCleanupService>(PendingCleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do nothing when no zombie PENDING records exist', async () => {
    reservationRepo.find.mockResolvedValue([]);

    await service.cleanupZombiePending();

    expect(reservationRepo.update).not.toHaveBeenCalled();
    expect(seatCounter.increment).not.toHaveBeenCalled();
  });

  it('should reject zombie PENDING records and increment counter', async () => {
    const zombies = [
      { id: 'res-1', concertId: 'c-1', status: ReservationStatus.PENDING },
      { id: 'res-2', concertId: 'c-2', status: ReservationStatus.PENDING },
    ];

    reservationRepo.find.mockResolvedValue(zombies);
    reservationRepo.update.mockResolvedValue({ affected: 1 });

    await service.cleanupZombiePending();

    // Should batch-reject all zombies in a single UPDATE call
    expect(reservationRepo.update).toHaveBeenCalledTimes(1);
    expect(reservationRepo.update).toHaveBeenCalledWith(
      ['res-1', 'res-2'],
      {
        status: ReservationStatus.REJECTED,
        rejectedReason: 'Processing timeout — please try again',
      },
    );

    // Should increment counter for each concert (return seats)
    expect(seatCounter.increment).toHaveBeenCalledTimes(2);
    expect(seatCounter.increment).toHaveBeenCalledWith('c-1');
    expect(seatCounter.increment).toHaveBeenCalledWith('c-2');
  });
});

import {
  Injectable,
  Inject,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';
import { KafkaService } from '../kafka/kafka.service';
import { SeatCounterService } from '../redis/seat-counter.service';
import { CONCERTS_LIST_CACHE_KEY } from '../common/constants';
import { AppException } from '../common/app-exception';
import { ErrorCode } from '../common/error-codes';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly kafkaService: KafkaService,
    private readonly seatCounter: SeatCounterService,
  ) {}

  /**
   * Reserve a seat for a user.
   *
   * When Kafka is enabled:
   *   1. Validate concert exists
   *   2. Redis DECR pre-check (BUG #8 fix: decrement at producer)
   *   3. Create reservation with PENDING status
   *   4. Publish to Kafka (partitioned by concertId for serialization)
   *   5. Return 202 Accepted — consumer will confirm or reject
   *
   * When Kafka is disabled (fallback):
   *   Uses Redis DECR pre-check + pessimistic locking
   */
  async reserve(userId: string, concertId: string) {
    if (this.kafkaService.isEnabled) {
      return this.reserveViaKafka(userId, concertId);
    }
    return this.reserveDirectly(userId, concertId);
  }

  /**
   * Kafka-based reservation: publish to queue, return PENDING.
   *
   * BUG #1 fix: DB unique index (UQ_pending_reservation) prevents duplicates.
   *             If constraint violation → catch and return conflict.
   * BUG #8 fix: DECR counter at producer (not just consumer) to close timing gap.
   */
  private async reserveViaKafka(userId: string, concertId: string) {
    // Quick validation: does the concert exist?
    const concert = await this.concertRepo.findOne({
      where: { id: concertId },
    });
    if (!concert) {
      throw new AppException(ErrorCode.CONCERT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // Optimistic pre-check for better UX error messages.
    // NOT the safety mechanism — the unique index UQ_pending_reservation is the real guard.
    const existing = await this.reservationRepo.findOne({
      where: [
        { userId, concertId, status: ReservationStatus.RESERVED },
        { userId, concertId, status: ReservationStatus.PENDING },
      ],
    });
    if (existing) {
      throw new AppException(
        existing.status === ReservationStatus.PENDING
          ? ErrorCode.RESERVATION_PROCESSING
          : ErrorCode.ALREADY_RESERVED,
        HttpStatus.CONFLICT,
      );
    }

    // BUG #8 fix: DECR counter at producer to close the timing gap
    // between publish and consumer processing
    const preCheck = await this.seatCounter.tryDecrement(concertId);
    if (preCheck === -1) {
      throw new AppException(ErrorCode.NO_SEATS_AVAILABLE, HttpStatus.BAD_REQUEST);
    }

    try {
      // BUG #1 fix: DB unique index (UQ_pending_reservation) prevents duplicate
      // PENDING records even under concurrent requests
      const reservation = this.reservationRepo.create({
        userId,
        concertId,
        status: ReservationStatus.PENDING,
      });
      const saved = await this.reservationRepo.save(reservation);

      // Publish to Kafka — partitioned by concertId for ordering
      await this.kafkaService.publishReservationRequest({
        reservationId: saved.id,
        userId,
        concertId,
        action: 'reserve',
      });

      return {
        ...saved,
        message: 'Reservation is being processed',
        statusCode: HttpStatus.ACCEPTED,
      };
    } catch (error) {
      // Rollback Redis counter if we decremented it
      if (preCheck !== null) {
        await this.seatCounter.increment(concertId);
      }

      // BUG #1 fix: Catch DB unique constraint violation (duplicate PENDING)
      if (this.isUniqueViolation(error)) {
        throw new AppException(ErrorCode.RESERVATION_PROCESSING, HttpStatus.CONFLICT);
      }

      throw error;
    }
  }

  /**
   * Direct reservation with Redis DECR pre-check + pessimistic locking.
   *
   * Flow:
   *   1. Redis DECR (O(1)) — fast reject if no seats
   *   2. DB transaction with pessimistic lock (safety net)
   *   3. If DB rejects → rollback Redis counter
   */
  private async reserveDirectly(userId: string, concertId: string) {
    // Fast pre-check: atomically decrement Redis counter
    const preCheck = await this.seatCounter.tryDecrement(concertId);
    if (preCheck === -1) {
      throw new AppException(ErrorCode.NO_SEATS_AVAILABLE, HttpStatus.BAD_REQUEST);
    }

    let result: Reservation;

    try {
      result = await this.dataSource.transaction(async (manager) => {
        // Lock the concert row to prevent concurrent overbooking
        const concert = await manager.findOne(Concert, {
          where: { id: concertId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!concert) {
          throw new AppException(ErrorCode.CONCERT_NOT_FOUND, HttpStatus.NOT_FOUND);
        }

        // Check if user already has an active reservation
        const existing = await manager.findOne(Reservation, {
          where: {
            userId,
            concertId,
            status: ReservationStatus.RESERVED,
          },
        });

        if (existing) {
          throw new AppException(ErrorCode.ALREADY_RESERVED, HttpStatus.CONFLICT);
        }

        // Check seat availability (DB source of truth)
        const reservedCount = await manager.count(Reservation, {
          where: {
            concertId,
            status: ReservationStatus.RESERVED,
          },
        });

        if (reservedCount >= concert.totalSeats) {
          throw new AppException(ErrorCode.NO_SEATS_AVAILABLE, HttpStatus.BAD_REQUEST);
        }

        // Create reservation directly as RESERVED
        const reservation = manager.create(Reservation, {
          userId,
          concertId,
          status: ReservationStatus.RESERVED,
        });

        return manager.save(reservation);
      });
    } catch (error) {
      // DB rejected → rollback Redis counter if it was decremented
      if (preCheck !== null) {
        await this.seatCounter.increment(concertId);
      }
      throw error;
    }

    // Invalidate list cache after successful reservation
    await this.cacheManager.del(CONCERTS_LIST_CACHE_KEY);

    return result;
  }

  /**
   * Cancel a reservation for a user.
   *
   * BUG #4 fix: Use atomic UPDATE with WHERE clause instead of find+save.
   * This prevents double-cancel race condition where two concurrent cancel
   * requests both find the same RESERVED record and both increment the counter.
   */
  async cancel(userId: string, concertId: string) {
    // Atomic: only one request can transition RESERVED → CANCELLED
    const result = await this.reservationRepo.update(
      {
        userId,
        concertId,
        status: ReservationStatus.RESERVED,
      },
      {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    );

    if (result.affected === 0) {
      throw new AppException(ErrorCode.RESERVATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // Only one request reaches here (the one that affected 1 row)
    await this.seatCounter.increment(concertId);
    await this.cacheManager.del(CONCERTS_LIST_CACHE_KEY);

    return {
      message: 'Reservation cancelled successfully',
      affected: result.affected,
    };
  }

  /**
   * Get personal reservation history for a user.
   */
  async getMyHistory(userId: string) {
    return this.reservationRepo.find({
      where: { userId },
      relations: ['concert'],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        status: true,
        rejectedReason: true,
        createdAt: true,
        cancelledAt: true,
        concert: { id: true, name: true, totalSeats: true },
      },
    });
  }

  /**
   * Get all reservation history (Admin only).
   * Supports pagination and filtering by status / user search.
   */
  async getAllHistory(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.concert', 'concert')
      .leftJoinAndSelect('r.user', 'user')
      .select([
        'r.id',
        'r.status',
        'r.rejectedReason',
        'r.createdAt',
        'r.cancelledAt',
        'concert.id',
        'concert.name',
        'concert.totalSeats',
        'user.id',
        'user.email',
        'user.fullName',
      ])
      .orderBy('r.createdAt', 'DESC');

    // Filter by status
    if (status && ['reserved', 'pending', 'cancelled', 'rejected'].includes(status)) {
      qb.andWhere('r.status = :status', { status });
    }

    // Search by user email or name
    if (search) {
      qb.andWhere(
        '(LOWER(user.email) LIKE :search OR LOWER(user.full_name) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [data, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if an error is a PostgreSQL unique constraint violation.
   */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}

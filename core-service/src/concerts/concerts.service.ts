import { Injectable, Inject, HttpStatus, Logger } from '@nestjs/common';
import { AppException } from '../common/app-exception';
import { ErrorCode } from '../common/error-codes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Concert } from '../entities/concert.entity';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { SeatCounterService } from '../redis/seat-counter.service';
import { KafkaService } from '../kafka/kafka.service';
import { AuditAction } from '../common/audit-actions';
import { CONCERTS_LIST_CACHE_KEY, CONCERTS_LIST_TTL } from '../common/constants';

export interface ConcertWithStats {
  id: string;
  name: string;
  description: string;
  totalSeats: number;
  createdAt: Date;
  updatedAt: Date;
  reservedSeats: number;
  cancelledSeats: number;
  availableSeats: number;
}

@Injectable()
export class ConcertsService {
  private readonly logger = new Logger(ConcertsService.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly seatCounter: SeatCounterService,
    private readonly kafkaService: KafkaService,
  ) {}

  /**
   * Create a new concert (Admin only).
   * Initializes the Redis seat counter and invalidates list cache.
   */
  async create(dto: CreateConcertDto, performedBy?: string): Promise<Concert> {
    const concert = this.concertRepo.create(dto);
    const saved = await this.concertRepo.save(concert);

    // Initialize atomic counter: all seats available
    await this.seatCounter.initCounter(saved.id, saved.totalSeats);

    // Publish audit log via Kafka
    if (performedBy) {
      await this.kafkaService.publishAuditLog({
        action: AuditAction.CREATE_CONCERT,
        entity: 'concert',
        entityId: saved.id,
        details: { name: saved.name, totalSeats: saved.totalSeats },
        performedBy,
        timestamp: new Date().toISOString(),
      });
    }

    await this.invalidateConcertListCache();
    return saved;
  }

  /**
   * List all concerts enriched with reservation stats.
   *
   * Strategy:
   *   1. Check JSON cache (TTL 30s) for the base list
   *   2. On cache miss → query DB with subqueries
   *   3. Overlay real-time availableSeats from Redis atomic counters
   *      (counters are updated on every reserve/cancel — always fresh)
   *   4. If counter doesn't exist for a concert → init from DB count (cold start)
   */
  async findAll(): Promise<ConcertWithStats[]> {
    // Try cache first for base data
    let concerts = await this.cacheManager.get<ConcertWithStats[]>(
      CONCERTS_LIST_CACHE_KEY,
    );

    if (!concerts) {
      // Cache miss → query DB
      const results = await this.concertRepo
        .createQueryBuilder('c')
        .select([
          'c.id AS id',
          'c.name AS name',
          'c.description AS description',
          'c.total_seats AS "totalSeats"',
          'c.created_at AS "createdAt"',
          'c.updated_at AS "updatedAt"',
        ])
        .addSelect(
          `COALESCE((SELECT COUNT(*) FROM reservations r WHERE r.concert_id = c.id AND r.status IN (:...activeStatuses)), 0)::int`,
          'reservedSeats',
        )
        .addSelect(
          `COALESCE((SELECT COUNT(*) FROM reservations r WHERE r.concert_id = c.id AND r.status = :cancelledStatus), 0)::int`,
          'cancelledSeats',
        )
        .setParameters({
          activeStatuses: [ReservationStatus.RESERVED, ReservationStatus.PENDING],
          cancelledStatus: ReservationStatus.CANCELLED,
        })
        .orderBy('c.created_at', 'DESC')
        .getRawMany();

      concerts = results.map((row) => ({
        ...row,
        totalSeats: Number(row.totalSeats),
        reservedSeats: Number(row.reservedSeats),
        cancelledSeats: Number(row.cancelledSeats),
        availableSeats: Number(row.totalSeats) - Number(row.reservedSeats),
      }));

      // Store base data in cache
      await this.cacheManager.set(
        CONCERTS_LIST_CACHE_KEY,
        concerts,
        CONCERTS_LIST_TTL,
      );
      this.logger.debug('Concert list cached (TTL: %dms)', CONCERTS_LIST_TTL);
    }

    // Overlay real-time seat counts from Redis atomic counters
    if (this.seatCounter.isEnabled && concerts.length > 0) {
      const concertIds = concerts.map((c) => c.id);
      const counters = await this.seatCounter.getAvailableBatch(concertIds);

      for (const concert of concerts) {
        const redisCount = counters.get(concert.id);
        if (redisCount !== undefined) {
          // Use real-time counter
          concert.availableSeats = redisCount;
          concert.reservedSeats = concert.totalSeats - redisCount;
        } else {
          // BUG #6 fix: Use SETNX to prevent overwriting a live counter
          await this.seatCounter.initCounterIfMissing(
            concert.id,
            concert.availableSeats,
          );
        }
      }
    }

    return concerts;
  }

  /**
   * Get a single concert by ID.
   */
  async findOne(id: string): Promise<Concert> {
    const concert = await this.concertRepo.findOne({ where: { id } });
    if (!concert) {
      throw new AppException(ErrorCode.CONCERT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return concert;
  }

  /**
   * Delete a concert (Admin only). Cascades to reservations via FK.
   * Cleans up the Redis seat counter and invalidates list cache.
   */
  async remove(id: string, performedBy?: string): Promise<void> {
    const concert = await this.findOne(id);

    // Publish audit log via Kafka before deletion (capture name while it still exists)
    if (performedBy) {
      await this.kafkaService.publishAuditLog({
        action: AuditAction.DELETE_CONCERT,
        entity: 'concert',
        entityId: id,
        details: { name: concert.name, totalSeats: concert.totalSeats },
        performedBy,
        timestamp: new Date().toISOString(),
      });
    }

    await this.concertRepo.remove(concert);

    // Cleanup counter
    await this.seatCounter.deleteCounter(id);

    await this.invalidateConcertListCache();
  }

  /**
   * Invalidate the concert list cache.
   * Called after create/delete operations to ensure fresh data.
   */
  async invalidateConcertListCache(): Promise<void> {
    await this.cacheManager.del(CONCERTS_LIST_CACHE_KEY);
    this.logger.debug('Concert list cache invalidated');
  }
}

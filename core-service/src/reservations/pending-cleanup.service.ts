import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { SeatCounterService } from '../redis/seat-counter.service';

/**
 * BUG #3 fix: Scheduled cleanup for zombie PENDING reservations.
 *
 * When Kafka is enabled, reservations start as PENDING and are processed
 * asynchronously. If the consumer crashes or messages are lost, PENDING
 * records can remain indefinitely — blocking the user from rebooking.
 *
 * This service runs every 2 minutes to:
 *   1. Find PENDING reservations older than 5 minutes
 *   2. Mark them as REJECTED with reason "Processing timeout"
 *   3. Increment the Redis counter for each (seat returned)
 */
@Injectable()
export class PendingCleanupService {
  private readonly logger = new Logger(PendingCleanupService.name);

  /** How old a PENDING record must be before cleanup (in milliseconds) */
  private readonly PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly seatCounter: SeatCounterService,
  ) {}

  /**
   * Runs every minute. Finds and rejects zombie PENDING reservations.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupZombiePending(): Promise<void> {
    const cutoff = new Date(Date.now() - this.PENDING_TIMEOUT_MS);

    // Find all zombie PENDING records
    const zombies = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.PENDING,
        createdAt: LessThan(cutoff),
      },
    });

    if (zombies.length === 0) return;

    this.logger.warn(
      `Found ${zombies.length} zombie PENDING reservation(s) older than 5 minutes`,
    );

    // Batch reject all zombies in a single UPDATE
    const ids = zombies.map((z) => z.id);
    await this.reservationRepo.update(ids, {
      status: ReservationStatus.REJECTED,
      rejectedReason: 'Processing timeout — please try again',
    });

    // Group by concertId and increment counters (avoid N+1 Redis calls)
    const countsByConcert = new Map<string, number>();
    for (const zombie of zombies) {
      countsByConcert.set(
        zombie.concertId,
        (countsByConcert.get(zombie.concertId) ?? 0) + 1,
      );
    }

    for (const [concertId, count] of countsByConcert) {
      for (let i = 0; i < count; i++) {
        await this.seatCounter.increment(concertId);
      }
      this.logger.warn(
        `Returned ${count} seat(s) for concert=${concertId}`,
      );
    }

    this.logger.log(
      `Cleaned up ${zombies.length} zombie PENDING reservation(s)`,
    );
  }
}

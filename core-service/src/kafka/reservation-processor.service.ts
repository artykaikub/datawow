import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { KafkaService, ReservationMessage } from './kafka.service';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';
import { SeatCounterService } from '../redis/seat-counter.service';
import { CONCERTS_LIST_CACHE_KEY, KAFKA_MAX_RETRIES } from '../common/constants';

@Injectable()
export class ReservationProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ReservationProcessorService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly seatCounter: SeatCounterService,
  ) {}

  async onModuleInit() {
    if (!this.kafkaService.isEnabled) {
      this.logger.warn(
        'Kafka disabled — reservation processor will not start',
      );
      return;
    }

    const consumer = await this.kafkaService.createConsumer();

    await consumer.run({
      // Process one message at a time per partition for strict ordering
      partitionsConsumedConcurrently: 1,
      eachMessage: async ({ partition, message }) => {
        const payload: ReservationMessage = JSON.parse(
          message.value!.toString(),
        );

        // B-H2: Track retry count from message headers
        const retryCount = message.headers?.['x-retry-count']
          ? parseInt(message.headers['x-retry-count'].toString(), 10)
          : 0;

        this.logger.debug(
          `Processing ${payload.action} [partition=${partition}, retry=${retryCount}] reservation=${payload.reservationId}`,
        );

        try {
          if (payload.action === 'reserve') {
            await this.processReservation(payload);
          } else if (payload.action === 'cancel') {
            await this.processCancellation(payload);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process reservation ${payload.reservationId} (attempt ${retryCount + 1}): ${error}`,
            error instanceof Error ? error.stack : undefined,
          );

          // B-H2: Send to DLQ after max retries
          if (retryCount >= KAFKA_MAX_RETRIES) {
            this.logger.error(
              `Max retries (${KAFKA_MAX_RETRIES}) exceeded for reservation ${payload.reservationId} — sending to DLQ`,
            );
            await this.kafkaService.publishToDLQ(payload, retryCount, String(error));
          } else {
            // Re-publish with incremented retry count
            await this.kafkaService.publishReservationRequest(payload, retryCount + 1);
          }
        }
      },
    });

    this.logger.log('Reservation processor started — consuming from Kafka');
  }

  /**
   * Process a reservation request.
   *
   * BUG #8 fix: Counter is already decremented by the producer.
   *   - Consumer does NOT decrement again.
   *   - Consumer only increments back (rollback) if DB rejects.
   *
   * BUG #1 fix: Also checks for other PENDING reservations from same user.
   *
   * Flow:
   *   1. DB transaction with pessimistic lock
   *   2. Check concert exists, duplicates (RESERVED + other PENDING), seat count
   *   3. If reject → INCR counter back (producer already decremented)
   *   4. If confirm → counter stays decremented (correct)
   */
  private async processReservation(payload: ReservationMessage): Promise<void> {
    let dbSuccess = false;

    try {
      await this.dataSource.transaction(async (manager) => {
        // Lock the concert row
        const concert = await manager.findOne(Concert, {
          where: { id: payload.concertId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!concert) {
          await this.rejectReservation(
            payload.reservationId,
            'Concert not found',
          );
          return;
        }

        // BUG #1 fix: Check for duplicate RESERVED reservation
        const existingReserved = await manager.findOne(Reservation, {
          where: {
            userId: payload.userId,
            concertId: payload.concertId,
            status: ReservationStatus.RESERVED,
          },
        });

        if (existingReserved) {
          await this.rejectReservation(
            payload.reservationId,
            'You already have a reservation for this concert',
          );
          return;
        }

        // BUG #1 fix: Check for OTHER pending reservations (not this one)
        // This catches the race where two PENDING records were created
        // despite the unique index (edge case with concurrent retries)
        const existingPending = await manager.findOne(Reservation, {
          where: {
            userId: payload.userId,
            concertId: payload.concertId,
            status: ReservationStatus.PENDING,
            id: Not(payload.reservationId),
          },
        });

        if (existingPending) {
          await this.rejectReservation(
            payload.reservationId,
            'Duplicate reservation detected',
          );
          return;
        }

        // Count current reservations (DB source of truth)
        const reservedCount = await manager.count(Reservation, {
          where: {
            concertId: payload.concertId,
            status: ReservationStatus.RESERVED,
          },
        });

        if (reservedCount >= concert.totalSeats) {
          await this.rejectReservation(
            payload.reservationId,
            'No seats available for this concert',
          );
          return;
        }

        // Confirm the reservation
        await manager.update(Reservation, payload.reservationId, {
          status: ReservationStatus.RESERVED,
        });

        dbSuccess = true;

        this.logger.log(
          `Reservation ${payload.reservationId} CONFIRMED (concert: ${concert.name}, seat ${reservedCount + 1}/${concert.totalSeats})`,
        );
      });
    } catch (error) {
      // DB transaction failed
      dbSuccess = false;
      await this.rejectReservation(
        payload.reservationId,
        'Internal processing error',
      );
      throw error;
    } finally {
      // BUG #8: Producer already decremented the counter.
      // If DB rejected → rollback counter (INCR back)
      if (!dbSuccess) {
        await this.seatCounter.increment(payload.concertId);
      }
      // If dbSuccess → counter stays decremented (correct)
    }

    // Invalidate concert list cache
    await this.cacheManager.del(CONCERTS_LIST_CACHE_KEY);
  }

  /**
   * Process a cancellation request.
   *
   * BUG #4 fix: Use atomic UPDATE instead of find+save to prevent
   * double-cancel race condition.
   */
  private async processCancellation(payload: ReservationMessage): Promise<void> {
    // Atomic: UPDATE WHERE status='reserved' → affected=0 if already cancelled
    const result = await this.reservationRepo.update(
      {
        id: payload.reservationId,
        userId: payload.userId,
        status: ReservationStatus.RESERVED,
      },
      {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    );

    if (result.affected === 0) {
      this.logger.warn(
        `Cancellation failed — no active reservation ${payload.reservationId}`,
      );
      return;
    }

    // Only increment if we actually cancelled (affected=1)
    await this.seatCounter.increment(payload.concertId);
    await this.cacheManager.del(CONCERTS_LIST_CACHE_KEY);

    this.logger.log(`Reservation ${payload.reservationId} CANCELLED`);
  }

  /**
   * Mark a reservation as rejected with a reason.
   */
  private async rejectReservation(
    reservationId: string,
    reason: string,
  ): Promise<void> {
    await this.reservationRepo.update(reservationId, {
      status: ReservationStatus.REJECTED,
      rejectedReason: reason,
    });

    this.logger.warn(`Reservation ${reservationId} REJECTED: ${reason}`);
  }
}

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis key format: "seats:{concertId}"
 * Value: number of AVAILABLE seats (integer)
 *
 * Atomic operations:
 *   DECR → reserve (returns new count; if < 0, INCR back → rejected)
 *   INCR → cancel  (returns new count)
 *   SET  → init    (set to totalSeats - reservedCount)
 *   DEL  → cleanup (concert deleted)
 *   GET  → display (real-time available seats)
 */
const SEAT_KEY_PREFIX = 'seats:';

@Injectable()
export class SeatCounterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeatCounterService.name);
  private redis: Redis | null = null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', '');
    this.enabled = !!redisUrl;

    if (this.enabled) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async onModuleInit() {
    if (!this.redis) {
      this.logger.warn(
        'REDIS_URL not set — seat counter disabled (will use DB counts)',
      );
      return;
    }

    try {
      await this.redis.connect();
      this.logger.log('Seat counter connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect Redis for seat counter', error);
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Initialize the counter for a concert (forced SET).
   * Called on concert creation — always overwrites.
   */
  async initCounter(concertId: string, availableSeats: number): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(this.key(concertId), availableSeats);
    this.logger.debug(
      `Counter initialized: ${concertId} → ${availableSeats} seats`,
    );
  }

  /**
   * BUG #6 fix: Initialize counter ONLY if it doesn't exist (SETNX).
   * Called during cold-start (findAll cache miss) to prevent overwriting
   * a live counter that may have been updated by concurrent reservations.
   */
  async initCounterIfMissing(concertId: string, availableSeats: number): Promise<void> {
    if (!this.redis) return;

    // SETNX: set only if key doesn't exist — prevents race condition
    const wasSet = await this.redis.setnx(this.key(concertId), availableSeats);
    if (wasSet) {
      this.logger.debug(
        `Counter cold-started: ${concertId} → ${availableSeats} seats`,
      );
    }
  }

  /**
   * Atomically decrement available seats using a Lua script.
   * The entire check-and-decrement happens in a single Redis roundtrip.
   *
   * Returns:
   *   null  — Redis disabled or key doesn't exist (fallback to DB)
   *   -1    — No seats available (auto-rolled back)
   *   >= 0  — New available count after decrement
   */
  async tryDecrement(concertId: string): Promise<number | null> {
    if (!this.redis) return null;

    // L-1: Atomic Lua script — no race condition between exists and decr
    // Returns: -2 if key doesn't exist, -1 if no seats, otherwise new count
    const luaScript = `
      local key = KEYS[1]
      if redis.call('exists', key) == 0 then
        return -2
      end
      local newVal = redis.call('decr', key)
      if newVal < 0 then
        redis.call('incr', key)
        return -1
      end
      return newVal
    `;

    const result = await this.redis.eval(luaScript, 1, this.key(concertId)) as number;

    if (result === -2) {
      return null; // Key doesn't exist — let DB handle it
    }

    if (result === -1) {
      this.logger.debug(`No seats available (counter): ${concertId}`);
      return -1;
    }

    this.logger.debug(
      `Seat decremented: ${concertId} → ${result} remaining`,
    );
    return result;
  }

  /**
   * Atomically increment available seats (on cancellation or reserve rollback).
   * B-H1 fix: Uses Lua script to prevent race between EXISTS and INCR.
   */
  async increment(concertId: string): Promise<number | null> {
    if (!this.redis) return null;

    // Atomic: only increment if key exists — prevents phantom counter creation
    const luaIncr = `
      if redis.call('exists', KEYS[1]) == 0 then return -1 end
      return redis.call('incr', KEYS[1])
    `;

    const result = await this.redis.eval(luaIncr, 1, this.key(concertId)) as number;

    if (result === -1) {
      return null; // Key doesn't exist — concert was deleted
    }

    this.logger.debug(
      `Seat incremented: ${concertId} → ${result} remaining`,
    );
    return result;
  }

  /**
   * Get current available seats from Redis.
   * Returns null if counter not initialized or Redis disabled.
   */
  async getAvailable(concertId: string): Promise<number | null> {
    if (!this.redis) return null;

    const val = await this.redis.get(this.key(concertId));
    return val !== null ? parseInt(val, 10) : null;
  }

  /**
   * Batch get available seats for multiple concerts.
   * Returns a Map<concertId, availableSeats>.
   */
  async getAvailableBatch(
    concertIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!this.redis || concertIds.length === 0) return result;

    const pipeline = this.redis.pipeline();
    for (const id of concertIds) {
      pipeline.get(this.key(id));
    }

    const replies = await pipeline.exec();
    if (!replies) return result;

    for (let i = 0; i < concertIds.length; i++) {
      const [err, val] = replies[i];
      if (!err && val !== null) {
        result.set(concertIds[i], parseInt(val as string, 10));
      }
    }

    return result;
  }

  /**
   * Delete the counter (on concert deletion).
   */
  async deleteCounter(concertId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(this.key(concertId));
    this.logger.debug(`Counter deleted: ${concertId}`);
  }

  private key(concertId: string): string {
    return `${SEAT_KEY_PREFIX}${concertId}`;
  }
}

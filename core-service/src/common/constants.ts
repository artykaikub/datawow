/**
 * Shared constants — single source of truth for cache keys and config values.
 * B-C2 fix: Eliminates duplicate CONCERTS_LIST_CACHE_KEY across 3 files.
 */

/** Cache key for the concert list with stats */
export const CONCERTS_LIST_CACHE_KEY = 'concerts:list';

/** TTL for concert list cache: 30 seconds */
export const CONCERTS_LIST_TTL = 30_000;

/** Max retries before sending to DLQ */
export const KAFKA_MAX_RETRIES = 3;

/** DLQ topic name */
export const RESERVATION_DLQ_TOPIC = 'reservation.dlq';

/** Audit log topic for admin action events */
export const AUDIT_LOG_TOPIC = 'audit.log';

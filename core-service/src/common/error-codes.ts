/**
 * Centralized error codes for the application.
 *
 * Convention:
 *   -1xxx  Auth errors
 *   -2xxx  Concert errors
 *   -3xxx  Reservation errors
 *   -9xxx  System / generic errors
 *
 * Frontend uses these codes to map i18n messages.
 * Backend NEVER returns user-facing text — only error codes.
 */
export const ErrorCode = {
  // ─── Auth (-1xxx) ───
  INVALID_CREDENTIALS:    -1000,
  EMAIL_ALREADY_EXISTS:   -1001,
  USER_NOT_FOUND:         -1002,
  INSUFFICIENT_ROLE:      -1003,

  // ─── Concert (-2xxx) ───
  CONCERT_NOT_FOUND:      -2000,

  // ─── Reservation (-3xxx) ───
  ALREADY_RESERVED:       -3000,
  NO_SEATS_AVAILABLE:     -3001,
  RESERVATION_NOT_FOUND:  -3002,
  RESERVATION_PROCESSING: -3003,

  // ─── System (-9xxx) ───
  VALIDATION_ERROR:       -9000,
  INTERNAL_ERROR:         -9001,
  RATE_LIMITED:           -9002,
  FORBIDDEN:             -9003,
  DB_CONFLICT:           -9004,
  DB_REF_NOT_FOUND:      -9005,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

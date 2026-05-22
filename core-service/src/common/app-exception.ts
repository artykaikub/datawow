import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeValue } from './error-codes';

/**
 * Custom exception that carries a numeric error code.
 * The GlobalExceptionFilter reads `errorCode` and includes it in the response.
 *
 * Usage:
 *   throw new AppException(ErrorCode.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
 */
export class AppException extends HttpException {
  public readonly errorCode: ErrorCodeValue;

  constructor(
    errorCode: ErrorCodeValue,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    /** Internal-only message for logging — never sent to client */
    debugMessage?: string,
  ) {
    super(
      {
        statusCode,
        errorCode,
        message: debugMessage || `Error code: ${errorCode}`,
      },
      statusCode,
    );
    this.errorCode = errorCode;
  }
}

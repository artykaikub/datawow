import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../app-exception';
import { ErrorCode } from '../error-codes';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: number = ErrorCode.INTERNAL_ERROR;

    if (exception instanceof AppException) {
      // Our custom exception — extract error code directly
      status = exception.getStatus();
      errorCode = exception.errorCode;

      this.logger.warn(
        `AppException [${errorCode}] ${exception.message} — ${req.method} ${req.url}`,
      );
    } else if (exception instanceof HttpException) {
      // Standard NestJS exceptions (ValidationPipe, ThrottlerGuard, etc.)
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown>;

      // Map known HTTP status to error codes
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        errorCode = ErrorCode.RATE_LIMITED;
      } else if (status === HttpStatus.FORBIDDEN) {
        errorCode = ErrorCode.FORBIDDEN;
      } else if (status === HttpStatus.BAD_REQUEST) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      } else {
        errorCode = ErrorCode.INTERNAL_ERROR;
      }

      // For validation errors, include field details
      const details = Array.isArray(body.message) ? body.message : undefined;

      res.status(status).json({
        statusCode: status,
        errorCode,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
        path: req.url,
      });
      return;
    } else if (exception instanceof QueryFailedError) {
      // B-H4: Handle TypeORM query errors
      const pgCode = (exception as QueryFailedError & { code?: string }).code;
      if (pgCode === '23505') {
        status = HttpStatus.CONFLICT;
        errorCode = ErrorCode.DB_CONFLICT;
      } else if (pgCode === '23503') {
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.DB_REF_NOT_FOUND;
      } else {
        this.logger.error(
          `QueryFailedError [${pgCode}]: ${exception.message}`,
          exception.stack,
        );
      }
    } else {
      this.logger.error(
        `Unhandled: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}

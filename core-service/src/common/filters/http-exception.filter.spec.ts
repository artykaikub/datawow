import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';
import { AppException } from '../app-exception';
import { ErrorCode } from '../error-codes';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: { status: jest.Mock };
  let mockRequest: { url: string; method: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    mockRequest = { url: '/test-path', method: 'GET' };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;

    // Silence logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when exception is an AppException', () => {
    it('should return the correct status code and errorCode', () => {
      const exception = new AppException(
        ErrorCode.CONCERT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: ErrorCode.CONCERT_NOT_FOUND,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });
  });

  describe('when exception is an HttpException', () => {
    it('should return the correct status code and errorCode', () => {
      const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: ErrorCode.FORBIDDEN,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });

    it('should map 429 to RATE_LIMITED error code', () => {
      const exception = new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorCode: ErrorCode.RATE_LIMITED,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });
  });

  describe('when exception is a BadRequestException with validation array', () => {
    it('should return 400 with validation details and VALIDATION_ERROR code', () => {
      const validationErrors = ['email must be an email', 'name should not be empty'];
      const exception = new BadRequestException(validationErrors);

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: ErrorCode.VALIDATION_ERROR,
        details: validationErrors,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });
  });

  describe('when exception is an unknown Error', () => {
    it('should return 500 with INTERNAL_ERROR code', () => {
      const exception = new Error('Something broke');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.INTERNAL_ERROR,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });

    it('should log the error with its stack trace', () => {
      const exception = new Error('Something broke');
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Unhandled: ${exception}`,
        exception.stack,
      );
    });
  });

  describe('when a non-Error value is thrown', () => {
    it('should return 500 for a thrown string', () => {
      filter.catch('unexpected string error', mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.INTERNAL_ERROR,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });

    it('should return 500 for a thrown number', () => {
      filter.catch(42, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.INTERNAL_ERROR,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });

    it('should return 500 for a thrown null', () => {
      filter.catch(null, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.INTERNAL_ERROR,
        timestamp: expect.any(String),
        path: '/test-path',
      });
    });

    it('should log without a stack trace for non-Error values', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      filter.catch('some string', mockHost);

      expect(loggerSpy).toHaveBeenCalledWith('Unhandled: some string', undefined);
    });
  });

  describe('when exception is a QueryFailedError', () => {
    it('should return 409 Conflict for unique constraint violation (23505)', () => {
      const { QueryFailedError } = require('typeorm');
      const exception = new QueryFailedError('INSERT...', [], new Error('duplicate key'));
      (exception as any).code = '23505';

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          errorCode: ErrorCode.DB_CONFLICT,
        }),
      );
    });

    it('should return 400 Bad Request for foreign key violation (23503)', () => {
      const { QueryFailedError } = require('typeorm');
      const exception = new QueryFailedError('INSERT...', [], new Error('FK violation'));
      (exception as any).code = '23503';

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: ErrorCode.DB_REF_NOT_FOUND,
        }),
      );
    });

    it('should return 500 and log error for unknown PG error code', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const { QueryFailedError } = require('typeorm');
      const exception = new QueryFailedError('INSERT...', [], new Error('something else'));
      (exception as any).code = '42P01';

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('QueryFailedError [42P01]'),
        expect.any(String),
      );
    });
  });
});

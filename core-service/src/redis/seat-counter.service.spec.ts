import { ConfigService } from '@nestjs/config';
import { SeatCounterService } from './seat-counter.service';

describe('SeatCounterService', () => {
  describe('when REDIS_URL is not set (disabled)', () => {
    let service: SeatCounterService;

    beforeEach(() => {
      const configService = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;
      service = new SeatCounterService(configService);
    });

    it('should be disabled', () => {
      expect(service.isEnabled).toBe(false);
    });

    it('initCounter should be a no-op', async () => {
      await expect(service.initCounter('c-1', 100)).resolves.not.toThrow();
    });

    it('initCounterIfMissing should be a no-op', async () => {
      await expect(service.initCounterIfMissing('c-1', 100)).resolves.not.toThrow();
    });

    it('tryDecrement should return null', async () => {
      expect(await service.tryDecrement('c-1')).toBeNull();
    });

    it('increment should return null', async () => {
      expect(await service.increment('c-1')).toBeNull();
    });

    it('getAvailable should return null', async () => {
      expect(await service.getAvailable('c-1')).toBeNull();
    });

    it('getAvailableBatch should return empty map', async () => {
      const result = await service.getAvailableBatch(['c-1', 'c-2']);
      expect(result.size).toBe(0);
    });

    it('getAvailableBatch with empty array should return empty map', async () => {
      const result = await service.getAvailableBatch([]);
      expect(result.size).toBe(0);
    });

    it('deleteCounter should be a no-op', async () => {
      await expect(service.deleteCounter('c-1')).resolves.not.toThrow();
    });

    it('onModuleInit should log warning and not throw', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('onModuleDestroy should not throw', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('when REDIS_URL is set (enabled with mock)', () => {
    let service: SeatCounterService;
    let mockRedis: Record<string, jest.Mock>;

    beforeEach(() => {
      const configService = {
        get: jest.fn().mockReturnValue('redis://localhost:6379'),
      } as unknown as ConfigService;
      service = new SeatCounterService(configService);

      // Replace the internal Redis instance with a mock
      mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
        setnx: jest.fn().mockResolvedValue(1),
        get: jest.fn().mockResolvedValue('50'),
        del: jest.fn().mockResolvedValue(1),
        eval: jest.fn().mockResolvedValue(49),
        connect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
        pipeline: jest.fn(),
      };
      (service as any).redis = mockRedis;
    });

    it('should be enabled', () => {
      expect(service.isEnabled).toBe(true);
    });

    // --- initCounter ---
    it('initCounter should SET the key with available seats', async () => {
      await service.initCounter('c-1', 100);
      expect(mockRedis.set).toHaveBeenCalledWith('seats:c-1', 100);
    });

    // --- initCounterIfMissing ---
    it('initCounterIfMissing should SETNX the key', async () => {
      mockRedis.setnx.mockResolvedValue(1); // was set (new key)
      await service.initCounterIfMissing('c-1', 75);
      expect(mockRedis.setnx).toHaveBeenCalledWith('seats:c-1', 75);
    });

    it('initCounterIfMissing should not overwrite existing key', async () => {
      mockRedis.setnx.mockResolvedValue(0); // key already existed
      await service.initCounterIfMissing('c-1', 75);
      expect(mockRedis.setnx).toHaveBeenCalledWith('seats:c-1', 75);
    });

    // --- tryDecrement ---
    it('tryDecrement should return new count when seats available', async () => {
      mockRedis.eval.mockResolvedValue(49); // 50 → 49

      const result = await service.tryDecrement('c-1');

      expect(result).toBe(49);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('decr'),
        1,
        'seats:c-1',
      );
    });

    it('tryDecrement should return -1 when no seats available', async () => {
      mockRedis.eval.mockResolvedValue(-1);

      const result = await service.tryDecrement('c-1');

      expect(result).toBe(-1);
    });

    it('tryDecrement should return null when key does not exist', async () => {
      mockRedis.eval.mockResolvedValue(-2);

      const result = await service.tryDecrement('c-1');

      expect(result).toBeNull();
    });

    // --- increment ---
    it('increment should return new count when key exists', async () => {
      mockRedis.eval.mockResolvedValue(51); // 50 → 51

      const result = await service.increment('c-1');

      expect(result).toBe(51);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('incr'),
        1,
        'seats:c-1',
      );
    });

    it('increment should return null when key does not exist', async () => {
      mockRedis.eval.mockResolvedValue(-1);

      const result = await service.increment('c-1');

      expect(result).toBeNull();
    });

    // --- getAvailable ---
    it('getAvailable should return parsed count', async () => {
      mockRedis.get.mockResolvedValue('42');

      const result = await service.getAvailable('c-1');

      expect(result).toBe(42);
      expect(mockRedis.get).toHaveBeenCalledWith('seats:c-1');
    });

    it('getAvailable should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getAvailable('c-1');

      expect(result).toBeNull();
    });

    // --- getAvailableBatch ---
    it('getAvailableBatch should return map of concert counts', async () => {
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '50'],
          [null, '30'],
          [null, null], // key doesn't exist
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getAvailableBatch(['c-1', 'c-2', 'c-3']);

      expect(result.get('c-1')).toBe(50);
      expect(result.get('c-2')).toBe(30);
      expect(result.has('c-3')).toBe(false); // null value → not in map
      expect(mockPipeline.get).toHaveBeenCalledTimes(3);
    });

    it('getAvailableBatch should handle pipeline returning null', async () => {
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getAvailableBatch(['c-1']);

      expect(result.size).toBe(0);
    });

    it('getAvailableBatch should skip entries with errors', async () => {
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [new Error('fail'), null],
          [null, '30'],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.getAvailableBatch(['c-1', 'c-2']);

      expect(result.has('c-1')).toBe(false); // error → skipped
      expect(result.get('c-2')).toBe(30);
    });

    // --- deleteCounter ---
    it('deleteCounter should DEL the key', async () => {
      await service.deleteCounter('c-1');
      expect(mockRedis.del).toHaveBeenCalledWith('seats:c-1');
    });

    // --- lifecycle ---
    it('onModuleInit should connect to Redis', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('onModuleInit should set redis to null on connection failure', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection refused'));
      await service.onModuleInit();
      expect((service as any).redis).toBeNull();
    });

    it('onModuleDestroy should quit Redis connection', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});

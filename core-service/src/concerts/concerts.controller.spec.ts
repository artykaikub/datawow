import { Test, TestingModule } from '@nestjs/testing';
import { ConcertsController } from './concerts.controller';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';

describe('ConcertsController', () => {
  let controller: ConcertsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConcertsController],
      providers: [{ provide: ConcertsService, useValue: service }],
    }).compile();

    controller = module.get<ConcertsController>(ConcertsController);
  });

  describe('create', () => {
    it('should delegate to concertsService.create and return the result', async () => {
      const dto: CreateConcertDto = {
        name: 'Test Concert',
        description: 'A great show',
        totalSeats: 500,
      };
      const expected = { id: 'uuid-1', ...dto };

      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto, { id: 'admin-1' });

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin-1');
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should delegate to concertsService.findAll and return the result', async () => {
      const expected = [
        {
          id: 'c-1',
          name: 'Concert 1',
          description: 'Desc',
          totalSeats: 100,
          reservedSeats: 30,
          cancelledSeats: 5,
          availableSeats: 70,
        },
      ];

      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when no concerts exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });


  describe('findOne', () => {
    it('should pass the id to concertsService.findOne and return the result', async () => {
      const expected = { id: 'c-1', name: 'Test Concert' };

      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('c-1');

      expect(result).toEqual(expected);
      expect(service.findOne).toHaveBeenCalledWith('c-1');
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors thrown by the service', async () => {
      service.findOne.mockRejectedValue(new Error('Concert not found'));

      await expect(controller.findOne('bad-id')).rejects.toThrow(
        'Concert not found',
      );
    });
  });

  describe('remove', () => {
    it('should pass the id to concertsService.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('c-1', { id: 'admin-1' });

      expect(result).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('c-1', 'admin-1');
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors thrown by the service', async () => {
      service.remove.mockRejectedValue(new Error('Concert not found'));

      await expect(controller.remove('bad-id', { id: 'admin-1' })).rejects.toThrow(
        'Concert not found',
      );
    });
  });
});

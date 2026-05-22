import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: AuditLogService, useValue: service },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with defaults', async () => {
      const expected = { data: [], total: 0, page: 1, limit: 50 };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(1, 50);
      expect(result).toEqual(expected);
    });

    it('should pass page and limit params', async () => {
      const expected = { data: [], total: 0, page: 2, limit: 20 };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(2, 20);

      expect(service.findAll).toHaveBeenCalledWith(2, 20);
      expect(result).toEqual(expected);
    });
  });
});

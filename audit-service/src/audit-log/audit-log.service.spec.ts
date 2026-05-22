import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: Record<string, jest.Mock>;

  const mockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const mockData = [
        {
          id: 'uuid-1',
          action: 'CREATE_CONCERT',
          entity: 'concert',
          entityId: 'c1',
          details: { name: 'Test' },
          performedBy: 'admin-1',
          createdAt: new Date(),
          performer: { id: 'admin-1', email: 'admin@test.com', fullName: 'Admin' },
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockData);
      repo.count.mockResolvedValue(1);

      const result = await service.findAll(1, 50);

      expect(result).toEqual({ data: mockData, total: 1, page: 1, limit: 50 });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
    });

    it('should cap limit at 200', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.findAll(1, 999);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(200);
    });

    it('should calculate correct offset for page 3', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.findAll(3, 20);

      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(40);
    });
  });
});

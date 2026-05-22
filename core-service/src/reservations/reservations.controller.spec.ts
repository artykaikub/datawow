import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let service: ReservationsService;

  const mockReservationsService = {
    reserve: jest.fn(),
    cancel: jest.fn(),
    getMyHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: mockReservationsService },
      ],
    }).compile();

    controller = module.get<ReservationsController>(ReservationsController);
    service = module.get<ReservationsService>(ReservationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reserve', () => {
    const user = { id: 'user-uuid-1234' };
    const concertId = 'concert-uuid-5678';

    it('should pass user.id and concertId to reservationsService.reserve', async () => {
      const expected = { id: 'reservation-1', userId: user.id, concertId };
      mockReservationsService.reserve.mockResolvedValue(expected);

      const result = await controller.reserve(user, concertId);

      expect(service.reserve).toHaveBeenCalledWith(user.id, concertId);
      expect(service.reserve).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });

    it('should propagate errors from the service', async () => {
      const error = new Error('Concert is sold out');
      mockReservationsService.reserve.mockRejectedValue(error);

      await expect(controller.reserve(user, concertId)).rejects.toThrow('Concert is sold out');
    });
  });

  describe('cancel', () => {
    const user = { id: 'user-uuid-1234' };
    const concertId = 'concert-uuid-5678';

    it('should pass user.id and concertId to reservationsService.cancel', async () => {
      const expected = { message: 'Reservation cancelled' };
      mockReservationsService.cancel.mockResolvedValue(expected);

      const result = await controller.cancel(user, concertId);

      expect(service.cancel).toHaveBeenCalledWith(user.id, concertId);
      expect(service.cancel).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });

    it('should propagate errors from the service', async () => {
      const error = new Error('Reservation not found');
      mockReservationsService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(user, concertId)).rejects.toThrow('Reservation not found');
    });
  });

  describe('getMyHistory', () => {
    const user = { id: 'user-uuid-1234' };

    it('should pass user.id to reservationsService.getMyHistory', async () => {
      const expected = [
        { id: 'reservation-1', concertId: 'concert-1' },
        { id: 'reservation-2', concertId: 'concert-2' },
      ];
      mockReservationsService.getMyHistory.mockResolvedValue(expected);

      const result = await controller.getMyHistory(user);

      expect(service.getMyHistory).toHaveBeenCalledWith(user.id);
      expect(service.getMyHistory).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });

    it('should return an empty array when no reservations exist', async () => {
      mockReservationsService.getMyHistory.mockResolvedValue([]);

      const result = await controller.getMyHistory(user);

      expect(service.getMyHistory).toHaveBeenCalledWith(user.id);
      expect(result).toEqual([]);
    });

    it('should propagate errors from the service', async () => {
      const error = new Error('Database error');
      mockReservationsService.getMyHistory.mockRejectedValue(error);

      await expect(controller.getMyHistory(user)).rejects.toThrow('Database error');
    });
  });
});

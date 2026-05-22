import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User, UserRole } from '../entities/user.entity';
import { AppException } from '../common/app-exception';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    };

    it('should register a new user and return a token', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({
        id: 'uuid-1',
        ...dto,
        role: UserRole.USER,
      });
      userRepo.save.mockResolvedValue({
        id: 'uuid-1',
        ...dto,
        role: UserRole.USER,
      });

      const result = await service.register(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe(dto.email);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(AppException);
      await expect(service.register(dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };

    it('should return token for valid credentials', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      // login() now explicitly selects password field
      userRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        password: hashed,
        fullName: 'Test',
        role: UserRole.USER,
      });

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
        select: ['id', 'email', 'password', 'fullName', 'role'],
      });
    });

    it('should throw UnauthorizedException for wrong email', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(AppException);
      await expect(service.login(dto)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        password: await bcrypt.hash('differentpassword', 10),
      });

      await expect(service.login(dto)).rejects.toThrow(AppException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile (password excluded by select: false)', async () => {
      // Simulates what TypeORM returns when select: false on password
      userRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.USER,
      });

      const result = await service.getProfile('uuid-1');

      expect(result).toEqual({
        id: 'uuid-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: UserRole.USER,
      });
      expect(result).not.toHaveProperty('password');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('bad-id')).rejects.toThrow(
        AppException,
      );
    });
  });
});

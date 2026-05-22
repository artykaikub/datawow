import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'register' | 'login' | 'getProfile'>>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      getProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // register() — C-1: Always creates USER role
  // ──────────────────────────────────────────────
  describe('register()', () => {
    const dto: RegisterDto = {
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'MyP@ss123',
    };

    const serviceResult = {
      accessToken: 'jwt-token',
      user: {
        id: 'uuid-1',
        email: dto.email,
        fullName: dto.fullName,
        role: UserRole.USER,
      },
    };

    it('should register a new user with USER role (no admin escalation)', async () => {
      authService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto);

      // No role param → always USER
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(serviceResult);
    });
  });

  // ──────────────────────────────────────────────
  // login()
  // ──────────────────────────────────────────────
  describe('login()', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'MyP@ss123',
    };

    it('should delegate to authService.login and return the result', async () => {
      const loginResult = {
        accessToken: 'jwt-token',
        user: {
          id: 'uuid-1',
          email: dto.email,
          fullName: 'John Doe',
          role: UserRole.USER,
        },
      };
      authService.login.mockResolvedValue(loginResult);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(loginResult);
    });
  });

  // ──────────────────────────────────────────────
  // getProfile()
  // ──────────────────────────────────────────────
  describe('getProfile()', () => {
    it('should pass user.id from the JWT payload to authService.getProfile', async () => {
      const userId = 'uuid-1';
      const profile = {
        id: userId,
        email: 'john@example.com',
        fullName: 'John Doe',
        password: 'not-loaded',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        reservations: [],
      };
      authService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile({ id: userId });

      expect(authService.getProfile).toHaveBeenCalledWith(userId);
      expect(result).toEqual(profile);
    });
  });
});

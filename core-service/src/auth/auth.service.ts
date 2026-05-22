import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AppException } from '../common/app-exception';
import { ErrorCode } from '../common/error-codes';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user. Hashes password with bcrypt (10 rounds).
   * Returns JWT access token on success.
   * Always creates USER role — admin must be promoted via seed/CLI.
   */
  async register(dto: RegisterDto, role: UserRole = UserRole.USER) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        `Registration attempt with existing email: ${dto.email}`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      email: dto.email,
      fullName: dto.fullName,
      password: hashedPassword,
      role,
    });

    const saved = await this.userRepo.save(user);
    return this.generateToken(saved);
  }

  /**
   * Authenticate user by email + password.
   * If dto.role is specified, validates the user has that role.
   * Returns JWT access token on success.
   */
  async login(dto: LoginDto) {
    // Explicitly select password since it's excluded by default
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password', 'fullName', 'role'],
    });

    if (!user) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        `Login attempt with unknown email: ${dto.email}`,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        `Invalid password for: ${dto.email}`,
      );
    }

    // Validate expected role — same error code to prevent user enumeration
    if (dto.role === 'admin' && user.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        `Non-admin login attempt via admin portal: ${dto.email}`,
      );
    }

    return this.generateToken(user);
  }

  /**
   * Get user profile by ID (password is automatically excluded via { select: false }).
   */
  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.UNAUTHORIZED,
        `Profile lookup for missing user: ${userId}`,
      );
    }
    return user;
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}

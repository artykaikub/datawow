import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Register a new user. Always creates a USER role.
   * Admin accounts must be created via seed script or admin-only endpoint.
   */
  @Post('register')
  @Throttle({ short: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user', description: 'Creates a new user account and returns a JWT token. Role is always "user".' })
  @ApiResponse({ status: 201, description: 'User registered successfully. Returns JWT token and user profile.' })
  @ApiResponse({ status: 400, description: 'Validation error (missing fields, invalid email, weak password).' })
  @ApiResponse({ status: 409, description: 'Registration failed.' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticate and receive JWT token.
   * Rate limited: 5 attempts per minute to prevent brute force.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password', description: 'Authenticates the user and returns a JWT token. Rate limited to 5 attempts per minute.' })
  @ApiResponse({ status: 200, description: 'Login successful. Returns JWT token and user profile.' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts. Try again later.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns the authenticated user\'s profile (excluding password).' })
  @ApiResponse({ status: 200, description: 'User profile returned successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid or missing JWT token.' })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }
}

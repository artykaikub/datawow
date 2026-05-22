import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'Registered email address' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'Expected role. If provided, login will be rejected if the user does not have this role.',
    enum: ['admin'],
  })
  @IsOptional()
  @IsIn(['admin'], { message: 'Invalid role' })
  role?: string;
}

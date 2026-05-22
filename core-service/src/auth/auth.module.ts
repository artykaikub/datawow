import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresInRaw = config.get<string>('JWT_EXPIRES_IN', '3600');
        // If it's a pure number string (e.g. "3600"), parse as integer (seconds).
        // If it contains letters (e.g. "1h", "7d"), pass as-is for ms() parsing.
        const expiresIn = /^\d+$/.test(expiresInRaw)
          ? parseInt(expiresInRaw, 10)
          : expiresInRaw;

        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn: expiresIn as number },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

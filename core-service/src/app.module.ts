import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import KeyvRedis from '@keyv/redis';
import { AuthModule } from './auth/auth.module';
import { ConcertsModule } from './concerts/concerts.module';
import { ReservationsModule } from './reservations/reservations.module';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { User } from './entities/user.entity';
import { Concert } from './entities/concert.entity';
import { Reservation } from './entities/reservation.entity';

@Module({
  imports: [
    // Load .env
    ConfigModule.forRoot({ isGlobal: true }),

    // BUG #3 fix: Enable CRON scheduling for zombie PENDING cleanup
    ScheduleModule.forRoot(),

    // Database — C-2: No default credentials, crash if not set
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [User, Concert, Reservation],
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: true,
        // M-7: Only log errors and warnings (prevents sensitive data in logs)
        logging: config.get<string>('NODE_ENV') === 'production'
          ? ['error']
          : ['error', 'warn', 'migration'],
      }),
    }),

    // Redis Cache — used for concert list caching (TTL 60s)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        // Graceful fallback: use in-memory cache if Redis is not configured
        return {
          stores: redisUrl ? [new KeyvRedis(redisUrl)] : undefined,
          ttl: 60_000, // 60s default TTL
        } as any;
      },
    }),

    // Rate Limiting — prevent reservation abuse
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 60_000,   // 1 minute window
          limit: 30,     // 30 requests per minute (general)
        },
      ],
    }),

    // Structured JSON logging (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req: (req: any) => ({
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
        },
      },
    }),

    // Feature modules
    RedisModule,
    AuthModule,
    ConcertsModule,
    ReservationsModule,
    KafkaModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply rate limiting globally — @Throttle decorators override per-route
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

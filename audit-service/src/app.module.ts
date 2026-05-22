import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Database — same Postgres as core-api, only operates on audit_logs table
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
        entities: [AuditLog],
        synchronize: false,
        // No migrations — table is managed by core-api
        logging: config.get<string>('NODE_ENV') === 'production'
          ? ['error']
          : ['error', 'warn'],
      }),
    }),

    AuthModule,
    AuditLogModule,
    KafkaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

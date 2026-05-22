import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  // SECURITY: Fail fast if JWT_SECRET is still the insecure default in production
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.JWT_SECRET ?? '').includes('change-in-production')
  ) {
    logger.error('FATAL: JWT_SECRET must be changed for production deployment!');
    process.exit(1);
  }

  // M-1: Security headers (X-Frame-Options, HSTS, CSP, etc.)
  app.use(helmet());

  // L-4: Request body size limit — prevent DoS via large payloads
  app.use(json({ limit: '1mb' }));

  // Global prefix: /api
  app.setGlobalPrefix('api');

  // H-4: Swagger only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DataWow Concert Tickets API')
      .setDescription(
        'RESTful API for free concert ticket reservation. ' +
        'Supports JWT authentication, role-based access (Admin/User), ' +
        'Redis caching, rate limiting, and Kafka-based concurrency control.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
        'JWT',
      )
      .addTag('Auth', 'Registration, login, and profile')
      .addTag('Concerts', 'Concert CRUD and reservation audit trail')
      .addTag('Reservations', 'Seat reservation and cancellation')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        tagsSorter: 'alpha',
      },
      customSiteTitle: 'DataWow Concert API — Swagger',
    });
    logger.log('📄 Swagger docs available at /api/docs');
  }

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // M-2: CORS origins from environment variable (configurable per environment)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3002'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Graceful shutdown — disconnect Kafka, Redis, DB on SIGTERM
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();

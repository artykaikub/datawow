/**
 * Script to export the Swagger/OpenAPI JSON spec from NestJS.
 * Runs without starting the HTTP server — just generates the document.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/swagger-export.ts
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function exportSwagger() {
  // Create app without listening
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

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
    .addServer('http://localhost:4000', 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outputPath = path.resolve(__dirname, '..', 'swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`✅ Swagger JSON exported to: ${outputPath}`);

  await app.close();
  process.exit(0);
}

exportSwagger().catch((err) => {
  console.error('Failed to export swagger:', err);
  process.exit(1);
});

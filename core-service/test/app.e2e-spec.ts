// @ts-nocheck — E2E test: supertest response callbacks use implicit `any`
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Backend E2E test suite.
 *
 * Prerequisites: A running PostgreSQL database accessible via .env.
 *   - Use `docker-compose up -d postgres` to start just Postgres.
 *   - Kafka/Redis are optional (Kafka disabled = sync mode, Redis disabled = DB-only counts).
 *
 * Run: `pnpm test:e2e`
 */
describe('App E2E', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;
  let testConcertId: string;

  const testUser = {
    email: `e2e-user-${Date.now()}@test.com`,
    password: 'TestPass123',
    fullName: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // Auth endpoints
  // ─────────────────────────────────────────────
  describe('Auth', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send(testUser)
          .expect(201)
          .expect((res) => {
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.user.email).toBe(testUser.email);
            expect(res.body.user.role).toBe('user');
            expect(res.body.user.password).toBeUndefined();
            userToken = res.body.accessToken;
          });
      });

      it('should reject duplicate email', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send(testUser)
          .expect(409);
      });

      it('should reject invalid email format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({ email: 'not-email', password: 'TestPass123', fullName: 'X' })
          .expect(400);
      });

      it('should reject weak password', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({ email: 'weak@test.com', password: '123', fullName: 'X' })
          .expect(400);
      });

      it('should reject missing fields', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({})
          .expect(400);
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: testUser.email, password: testUser.password })
          .expect(200)
          .expect((res) => {
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.user.email).toBe(testUser.email);
            userToken = res.body.accessToken;
          });
      });

      it('should reject wrong password', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: testUser.email, password: 'WrongPass999' })
          .expect(401);
      });

      it('should reject non-existent user', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'noone@nowhere.com', password: 'TestPass123' })
          .expect(401);
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return profile for authenticated user', () => {
        return request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.email).toBe(testUser.email);
            expect(res.body.password).toBeUndefined();
          });
      });

      it('should reject unauthenticated request', () => {
        return request(app.getHttpServer())
          .get('/api/auth/me')
          .expect(401);
      });

      it('should reject invalid token', () => {
        return request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid-token-xyz')
          .expect(401);
      });
    });
  });

  // ─────────────────────────────────────────────
  // Admin login (try existing admin)
  // ─────────────────────────────────────────────
  describe('Admin flow', () => {
    beforeAll(async () => {
      // Try to login as admin; skip admin tests if admin doesn't exist
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@datawow.com', password: 'Admin123!' });

      if (res.status === 200) {
        adminToken = res.body.accessToken;
      }
    });

    // ─────────────────────────────────────────────
    // Concerts CRUD (Admin)
    // ─────────────────────────────────────────────
    describe('POST /api/concerts', () => {
      it('should create a concert (admin)', async () => {
        if (!adminToken) return;

        const res = await request(app.getHttpServer())
          .post('/api/concerts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `E2E Concert ${Date.now()}`,
            description: 'E2E test concert',
            totalSeats: 100,
          })
          .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.name).toContain('E2E Concert');
        testConcertId = res.body.id;
      });

      it('should reject create without admin role', () => {
        return request(app.getHttpServer())
          .post('/api/concerts')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name: 'X', description: 'X', totalSeats: 10 })
          .expect(403);
      });

      it('should reject create without auth', () => {
        return request(app.getHttpServer())
          .post('/api/concerts')
          .send({ name: 'X', description: 'X', totalSeats: 10 })
          .expect(401);
      });

      it('should validate totalSeats max', async () => {
        if (!adminToken) return;

        return request(app.getHttpServer())
          .post('/api/concerts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'X', description: 'X', totalSeats: 999999 })
          .expect(400);
      });
    });

    describe('GET /api/concerts', () => {
      it('should list concerts with stats', () => {
        return request(app.getHttpServer())
          .get('/api/concerts')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            if (res.body.length > 0) {
              expect(res.body[0]).toHaveProperty('totalSeats');
              expect(res.body[0]).toHaveProperty('reservedSeats');
              expect(res.body[0]).toHaveProperty('availableSeats');
            }
          });
      });

      it('should reject without auth', () => {
        return request(app.getHttpServer())
          .get('/api/concerts')
          .expect(401);
      });
    });

    describe('GET /api/concerts/:id', () => {
      it('should return a single concert', async () => {
        if (!testConcertId) return;

        return request(app.getHttpServer())
          .get(`/api/concerts/${testConcertId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(testConcertId);
          });
      });

      it('should return 404 for non-existent UUID', () => {
        return request(app.getHttpServer())
          .get('/api/concerts/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);
      });

      it('should return 400 for invalid UUID', () => {
        return request(app.getHttpServer())
          .get('/api/concerts/not-a-uuid')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);
      });
    });

    describe('GET /api/concerts/history/all', () => {
      it('should return paginated history (admin)', async () => {
        if (!adminToken) return;

        return request(app.getHttpServer())
          .get('/api/concerts/history/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('total');
            expect(res.body).toHaveProperty('page');
            expect(res.body).toHaveProperty('limit');
          });
      });

      it('should reject non-admin access to history', () => {
        return request(app.getHttpServer())
          .get('/api/concerts/history/all')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });

  // ─────────────────────────────────────────────
  // Reservations (User)
  // ─────────────────────────────────────────────
  describe('Reservations', () => {
    describe('POST /api/reservations/:concertId', () => {
      it('should reserve a seat', async () => {
        if (!testConcertId) return;

        const res = await request(app.getHttpServer())
          .post(`/api/reservations/${testConcertId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect((response) => {
            // 201 (sync) or 202 (Kafka async)
            expect([201, 202]).toContain(response.status);
          });
      });

      it('should reject double reservation', async () => {
        if (!testConcertId) return;

        return request(app.getHttpServer())
          .post(`/api/reservations/${testConcertId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(409);
      });

      it('should reject reservation for non-existent concert', () => {
        return request(app.getHttpServer())
          .post('/api/reservations/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);
      });

      it('should reject admin from reserving', async () => {
        if (!adminToken || !testConcertId) return;

        return request(app.getHttpServer())
          .post(`/api/reservations/${testConcertId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(403);
      });
    });

    describe('GET /api/reservations/me', () => {
      it('should return user reservation history', () => {
        return request(app.getHttpServer())
          .get('/api/reservations/me')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });

      it('should reject without auth', () => {
        return request(app.getHttpServer())
          .get('/api/reservations/me')
          .expect(401);
      });
    });

    describe('DELETE /api/reservations/:concertId', () => {
      it('should cancel a reservation', async () => {
        if (!testConcertId) return;

        return request(app.getHttpServer())
          .delete(`/api/reservations/${testConcertId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.message).toContain('cancelled');
          });
      });

      it('should reject cancelling non-existent reservation', async () => {
        if (!testConcertId) return;

        return request(app.getHttpServer())
          .delete(`/api/reservations/${testConcertId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);
      });
    });
  });

  // ─────────────────────────────────────────────
  // Cleanup: Delete test concert (Admin)
  // ─────────────────────────────────────────────
  describe('Cleanup', () => {
    it('should delete test concert (admin)', async () => {
      if (!adminToken || !testConcertId) return;

      return request(app.getHttpServer())
        .delete(`/api/concerts/${testConcertId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  // ─────────────────────────────────────────────
  // Global error handling
  // ─────────────────────────────────────────────
  describe('Error handling', () => {
    it('should return JSON for unknown routes', () => {
      return request(app.getHttpServer())
        .get('/api/nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });
});

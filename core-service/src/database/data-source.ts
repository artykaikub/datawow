import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'datawow',
  password: process.env.DB_PASSWORD ?? 'datawow_secret',
  database: process.env.DB_NAME ?? 'datawow_concert',
  entities: ['src/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});

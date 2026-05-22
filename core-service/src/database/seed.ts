import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { Concert } from '../entities/concert.entity';
import { Reservation } from '../entities/reservation.entity';
import { config } from 'dotenv';

config(); // Load .env

/**
 * Seed script: Creates the default admin account.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seed.ts
 *
 * Or via npm script:
 *   pnpm seed
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'datawow',
    password: process.env.DB_PASSWORD || 'datawow_secret',
    database: process.env.DB_NAME || 'datawow_concert',
    entities: [User, Concert, Reservation],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database connected');

  const userRepo = dataSource.getRepository(User);

  // ─── Admin account ───
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@datawow.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existing = await userRepo.findOne({ where: { email: adminEmail } });

  if (existing) {
    console.log(`Admin "${adminEmail}" already exists (role: ${existing.role})`);

    // Ensure role is admin even if user was created via register
    if (existing.role !== UserRole.ADMIN) {
      existing.role = UserRole.ADMIN;
      await userRepo.save(existing);
      console.log(`→ Promoted to ADMIN role`);
    }
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = userRepo.create({
      email: adminEmail,
      fullName: 'System Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
    });
    await userRepo.save(admin);
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  }

  await dataSource.destroy();
  console.log('Seed completed ✅');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

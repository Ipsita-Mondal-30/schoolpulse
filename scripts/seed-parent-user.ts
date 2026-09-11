/**
 * Seed or update a parent user for local/dev testing.
 * Usage:
 *   SEED_PARENT_EMAIL=parent@example.com SEED_PARENT_PASSWORD='...' npx tsx scripts/seed-parent-user.ts
 *
 * Does NOT invent class/child relationships.
 */
import { config } from 'dotenv';
config();
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = (process.env.SEED_PARENT_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_PARENT_PASSWORD || '';
  const name = process.env.SEED_PARENT_NAME || 'Parent';

  if (!email || !password) {
    console.error('Set SEED_PARENT_EMAIL and SEED_PARENT_PASSWORD');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_PARENT_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: 'parent',
      passwordHash,
    },
    update: {
      name,
      role: 'parent',
      passwordHash,
    },
  });

  console.log(`[SchoolPulse] Parent user ready: ${user.email} (id=${user.id})`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Bootstrap / heal ParentStudent links for the NeverSkip-synced child.
 *
 * Usage:
 *   npx tsx scripts/ensure-synced-child.ts
 *
 * Optional:
 *   SYNCED_CHILD_NAME="Aarav"
 *   SYNCED_CHILD_SECTION=I-A
 *   NEVERSKIP_STUDENT_ID=...
 */
import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { refreshSyncedChildAfterImport } from '../lib/synced-child';

async function main() {
  const prisma = new PrismaClient();
  try {
    const identity = await refreshSyncedChildAfterImport(prisma);
    if (!identity) {
      console.error(
        '[SchoolPulse] No NeverSkip import data yet — refusing to create a phantom child.',
      );
      process.exit(1);
    }
    const links = await prisma.parentStudent.count({
      where: { studentId: identity.studentId },
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          studentId: identity.studentId,
          neverSkipStudentId: identity.neverSkipStudentId,
          displayName: identity.displayName,
          classLabel: identity.classLabel,
          parentLinks: links,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

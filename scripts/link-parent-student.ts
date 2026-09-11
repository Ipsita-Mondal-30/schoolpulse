/**
 * Link (or approve) a parent User to a Student for acknowledgements.
 *
 * Usage examples:
 *   LINK_PARENT_EMAIL=parent@example.com LINK_STUDENT_ID=clxxx LINK_STATUS=approved \
 *     npx tsx scripts/link-parent-student.ts
 *
 *   LINK_PARENT_EMAIL=parent@example.com LINK_STUDENT_NAME="Aarav" LINK_CLASS_SECTION=I-A \
 *     LINK_STATUS=approved npx tsx scripts/link-parent-student.ts
 *
 * Optional: LINK_CREATE_STUDENT=1 with LINK_STUDENT_NAME + LINK_CLASS_SECTION (or LINK_CLASS_ID)
 * creates the Student row if missing.
 *
 * Does not invent NeverSkip data or auto-grant unrelated classes.
 */
import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import {
  PARENT_STUDENT_APPROVED,
  PARENT_STUDENT_PENDING,
  PARENT_STUDENT_REJECTED,
  classLabelFromParts,
  normalizeClassLabel,
} from '../lib/parent-access';

const ALLOWED = new Set([
  PARENT_STUDENT_APPROVED,
  PARENT_STUDENT_PENDING,
  PARENT_STUDENT_REJECTED,
]);

async function main() {
  const email = (process.env.LINK_PARENT_EMAIL || '').trim().toLowerCase();
  const studentId = (process.env.LINK_STUDENT_ID || '').trim();
  const studentName = (process.env.LINK_STUDENT_NAME || '').trim();
  const classIdEnv = (process.env.LINK_CLASS_ID || '').trim();
  const classSection = (process.env.LINK_CLASS_SECTION || '').trim();
  const status = (process.env.LINK_STATUS || PARENT_STUDENT_APPROVED).trim().toLowerCase();
  const createStudent = process.env.LINK_CREATE_STUDENT === '1';

  if (!email) {
    console.error('Set LINK_PARENT_EMAIL');
    process.exit(1);
  }
  if (!ALLOWED.has(status)) {
    console.error(`LINK_STATUS must be one of: ${[...ALLOWED].join(', ')}`);
    process.exit(1);
  }
  if (!studentId && !studentName) {
    console.error('Set LINK_STUDENT_ID or LINK_STUDENT_NAME');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const parent = await prisma.user.findUnique({ where: { email } });
  if (!parent) {
    console.error(`Parent user not found for email: ${email}`);
    process.exit(1);
  }
  if (parent.role !== 'parent') {
    console.error(`User ${email} has role=${parent.role}, expected parent`);
    process.exit(1);
  }

  let student = studentId
    ? await prisma.student.findUnique({
        where: { id: studentId },
        include: { class: true },
      })
    : null;

  if (!student && studentName) {
    const matches = await prisma.student.findMany({
      where: {
        displayName: { equals: studentName, mode: 'insensitive' },
        ...(classIdEnv ? { classId: classIdEnv } : {}),
      },
      include: { class: true },
    });

    if (classSection && matches.length > 1) {
      const want = normalizeClassLabel(classSection);
      const filtered = matches.filter(
        (s) => classLabelFromParts(s.class.name, s.class.section) === want,
      );
      if (filtered.length === 1) student = filtered[0];
      else if (filtered.length > 1) {
        console.error(
          `Multiple students named "${studentName}" in ${classSection}: ${filtered.map((s) => s.id).join(', ')}`,
        );
        process.exit(1);
      }
    } else if (matches.length === 1) {
      student = matches[0];
    } else if (matches.length > 1) {
      console.error(
        `Multiple students named "${studentName}". Pass LINK_STUDENT_ID or LINK_CLASS_SECTION.`,
      );
      process.exit(1);
    }
  }

  if (!student && createStudent && studentName) {
    let classId = classIdEnv;
    if (!classId && classSection) {
      const want = normalizeClassLabel(classSection);
      const classes = await prisma.class.findMany();
      const match = classes.find(
        (c) => classLabelFromParts(c.name, c.section) === want,
      );
      if (!match) {
        console.error(
          `No Class found for section/label "${classSection}". Create Class first or set LINK_CLASS_ID.`,
        );
        process.exit(1);
      }
      classId = match.id;
    }
    if (!classId) {
      console.error('LINK_CREATE_STUDENT requires LINK_CLASS_ID or LINK_CLASS_SECTION');
      process.exit(1);
    }
    student = await prisma.student.create({
      data: { displayName: studentName, classId },
      include: { class: true },
    });
    console.log(`[SchoolPulse] Created Student ${student.id} (${student.displayName})`);
  }

  if (!student) {
    console.error('Student not found. Set LINK_STUDENT_ID or create with LINK_CREATE_STUDENT=1');
    process.exit(1);
  }

  const link = await prisma.parentStudent.upsert({
    where: {
      parentUserId_studentId: {
        parentUserId: parent.id,
        studentId: student.id,
      },
    },
    create: {
      parentUserId: parent.id,
      studentId: student.id,
      status,
    },
    update: { status },
  });

  const label = classLabelFromParts(student.class.name, student.class.section);
  console.log(
    `[SchoolPulse] Linked ${parent.email} ↔ ${student.displayName} (${label || student.classId}) status=${link.status}`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Canonical synced child identity for SchoolPulse.
 *
 * NeverSkip parent-portal sync is account-scoped (one family's child).
 * SchoolPulse models that as School → Class → Student + ParentStudent links.
 * Without those rows, sign-in succeeds but acknowledgements / child UI fail
 * with "No linked child yet".
 */

import type { PrismaClient } from '@prisma/client';
import {
  classLabelFromParts,
  normalizeClassLabel,
  PARENT_STUDENT_APPROVED,
} from '@/lib/parent-access';
import { isClass1Section, type Class1Section } from '@/lib/class-sections';

export const SYNCED_SCHOOL_CODE = 'neverskip-synced';
/** Stable NeverSkip-side identity when the portal does not expose a student id. */
export const DEFAULT_NEVERSKIP_STUDENT_ID = 'neverskip-synced-primary';

export type SyncedChildIdentity = {
  studentId: string;
  neverSkipStudentId: string;
  displayName: string;
  classLabel: string;
  classId: string;
  schoolId: string;
};

function envTrim(key: string): string {
  return (process.env[key] || '').trim();
}

export function resolveConfiguredNeverSkipStudentId(): string {
  return envTrim('NEVERSKIP_STUDENT_ID') || DEFAULT_NEVERSKIP_STUDENT_ID;
}

export function resolveConfiguredChildName(): string {
  return envTrim('SYNCED_CHILD_NAME') || 'Your child';
}

export function resolveConfiguredSection(): Class1Section | null {
  const raw = normalizeClassLabel(envTrim('SYNCED_CHILD_SECTION'));
  if (raw && isClass1Section(raw)) return raw;
  return null;
}

/**
 * Infer the family's section from recent NeverSkip homework audience tags.
 * Falls back to I-A when nothing is configured / imported yet.
 */
export async function inferPrimarySection(
  prisma: PrismaClient,
): Promise<Class1Section> {
  const configured = resolveConfiguredSection();
  if (configured) return configured;

  const rows = await prisma.importedHomework.findMany({
    orderBy: [{ homeworkDate: 'desc' }],
    take: 40,
    select: { sectionsJson: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.sectionsJson) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const raw of parsed) {
        const label = normalizeClassLabel(String(raw));
        if (label && isClass1Section(label)) {
          counts.set(label, (counts.get(label) || 0) + 1);
        }
      }
    } catch {
      /* ignore bad json */
    }
  }

  let best: Class1Section = 'I-A';
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label as Class1Section;
      bestCount = count;
    }
  }
  return best;
}

async function ensureSchoolClassStudent(
  prisma: PrismaClient,
  section: Class1Section,
): Promise<SyncedChildIdentity> {
  const neverSkipStudentId = resolveConfiguredNeverSkipStudentId();
  const displayName = resolveConfiguredChildName();

  const school = await prisma.school.upsert({
    where: { code: SYNCED_SCHOOL_CODE },
    create: {
      name: envTrim('SYNCED_SCHOOL_NAME') || 'Synced school',
      code: SYNCED_SCHOOL_CODE,
    },
    update: {},
  });

  const existingClass = await prisma.class.findFirst({
    where: {
      schoolId: school.id,
      name: 'I',
      section,
    },
  });

  const klass =
    existingClass ||
    (await prisma.class.create({
      data: {
        schoolId: school.id,
        name: 'I',
        section,
      },
    }));

  let student = await prisma.student.findFirst({
    where: { neverSkipStudentId },
    include: { class: true },
  });

  if (!student) {
    student = await prisma.student.create({
      data: {
        displayName,
        classId: klass.id,
        neverSkipStudentId,
      },
      include: { class: true },
    });
  } else {
    const nextName =
      displayName !== 'Your child' && student.displayName !== displayName
        ? displayName
        : student.displayName;
    if (student.classId !== klass.id || nextName !== student.displayName) {
      student = await prisma.student.update({
        where: { id: student.id },
        data: {
          classId: klass.id,
          displayName: nextName,
        },
        include: { class: true },
      });
    }
  }

  const classLabel =
    classLabelFromParts(student.class.name, student.class.section) || section;

  return {
    studentId: student.id,
    neverSkipStudentId,
    displayName: student.displayName,
    classLabel,
    classId: student.classId,
    schoolId: school.id,
  };
}

/**
 * Ensure the NeverSkip-synced Student (+ School/Class) exists.
 * Does not invent homework/notices — only identity rows for filtering/auth.
 */
export async function ensureSyncedChildIdentity(
  prisma: PrismaClient,
): Promise<SyncedChildIdentity | null> {
  if (!process.env.DATABASE_URL) return null;

  const hwCount = await prisma.importedHomework.count();
  const noticeCount = await prisma.importedNotice.count();
  const jolCount = await prisma.importedJolItem.count();
  if (hwCount + noticeCount + jolCount === 0) {
    // No NeverSkip data yet — do not create a phantom child.
    return null;
  }

  const section = await inferPrimarySection(prisma);
  return ensureSchoolClassStudent(prisma, section);
}

/**
 * Approve-link a parent User to the synced NeverSkip child when missing.
 */
export async function ensureParentLinkedToSyncedChild(
  prisma: PrismaClient,
  parentUserId: string,
): Promise<SyncedChildIdentity | null> {
  const identity = await ensureSyncedChildIdentity(prisma);
  if (!identity) return null;

  await prisma.parentStudent.upsert({
    where: {
      parentUserId_studentId: {
        parentUserId,
        studentId: identity.studentId,
      },
    },
    create: {
      parentUserId,
      studentId: identity.studentId,
      status: PARENT_STUDENT_APPROVED,
    },
    update: {
      status: PARENT_STUDENT_APPROVED,
    },
  });

  return identity;
}

/**
 * After a successful NeverSkip → Neon sync, refresh identity + link all
 * existing parent accounts to the synced child (single-family deployment).
 */
export async function refreshSyncedChildAfterImport(
  prisma: PrismaClient,
): Promise<SyncedChildIdentity | null> {
  const identity = await ensureSyncedChildIdentity(prisma);
  if (!identity) return null;

  const parents = await prisma.user.findMany({
    where: { role: 'parent' },
    select: { id: true },
  });

  for (const parent of parents) {
    await prisma.parentStudent.upsert({
      where: {
        parentUserId_studentId: {
          parentUserId: parent.id,
          studentId: identity.studentId,
        },
      },
      create: {
        parentUserId: parent.id,
        studentId: identity.studentId,
        status: PARENT_STUDENT_APPROVED,
      },
      update: {
        status: PARENT_STUDENT_APPROVED,
      },
    });
  }

  return identity;
}

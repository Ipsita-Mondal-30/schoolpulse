/**
 * Parent ↔ student class access helpers.
 * Does not invent access: only approved ParentStudent links count.
 */

import type { PrismaClient } from '@prisma/client';

export const PARENT_STUDENT_APPROVED = 'approved';
export const PARENT_STUDENT_PENDING = 'pending';
export const PARENT_STUDENT_REJECTED = 'rejected';

export const ERR_NO_LINKED_CHILD = 'No linked child yet';
export const ERR_NOT_FOR_LINKED_CLASS = 'Not available for your linked class';

/** Normalize Class.section / Class.name / NeverSkip labels to comparable codes. */
export function normalizeClassLabel(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CLASS/, '');
}

/**
 * Prefer section (e.g. I-A); fall back to name if it looks like a section code.
 */
export function classLabelFromParts(name?: string | null, section?: string | null): string {
  const fromSection = normalizeClassLabel(section);
  if (fromSection) return fromSection;
  return normalizeClassLabel(name);
}

/**
 * True if item targeting intersects parent's approved class labels.
 * Empty item targeting: treat as I-A only when product default does (match UI).
 */
export function itemTargetsIntersect(
  itemTargets: string[],
  approvedLabels: string[],
): boolean {
  if (approvedLabels.length === 0) return false;

  const approved = new Set(approvedLabels.map(normalizeClassLabel).filter(Boolean));
  let targets = (itemTargets || []).map(normalizeClassLabel).filter(Boolean);

  // Match existing UI: empty homework sections default toward I-A visibility
  if (targets.length === 0) {
    targets = ['I-A'];
  }

  if (targets.includes('ALL') || targets.includes('ALLCLASSES')) {
    return approved.size > 0;
  }

  return targets.some((t) => approved.has(t));
}

export function parentHasApprovedLink(approvedLabels: string[]): boolean {
  return approvedLabels.length > 0;
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Class section labels for students with an approved ParentStudent link.
 */
export async function listApprovedStudentClasses(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const links = await prisma.parentStudent.findMany({
    where: {
      parentUserId: userId,
      status: PARENT_STUDENT_APPROVED,
    },
    include: {
      student: {
        include: {
          class: { select: { name: true, section: true } },
        },
      },
    },
  });

  const labels = new Set<string>();
  for (const link of links) {
    const label = classLabelFromParts(link.student.class.name, link.student.class.section);
    if (label) labels.add(label);
  }
  return [...labels];
}

export async function parentCanAccessHomework(
  prisma: PrismaClient,
  userId: string,
  sections: string[],
): Promise<boolean> {
  const approved = await listApprovedStudentClasses(prisma, userId);
  return itemTargetsIntersect(sections, approved);
}

export async function parentCanAccessNotice(
  prisma: PrismaClient,
  userId: string,
  classes: string[],
): Promise<boolean> {
  const approved = await listApprovedStudentClasses(prisma, userId);
  return itemTargetsIntersect(classes, approved);
}

export function sectionsFromHomeworkJson(sectionsJson: string): string[] {
  return parseJsonStringArray(sectionsJson);
}

export function classesFromNoticeJson(classesJson: string): string[] {
  return parseJsonStringArray(classesJson);
}

/**
 * Gate acknowledge writes. Returns error message or null if allowed.
 */
export function acknowledgeAccessError(
  approvedLabels: string[],
  itemTargets: string[],
): string | null {
  if (!parentHasApprovedLink(approvedLabels)) {
    return ERR_NO_LINKED_CHILD;
  }
  if (!itemTargetsIntersect(itemTargets, approvedLabels)) {
    return ERR_NOT_FOR_LINKED_CLASS;
  }
  return null;
}

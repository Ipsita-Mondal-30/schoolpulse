'use server';

import { auth, PARENT_ROLE } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { NEVERSKIP_SOURCE } from '@/lib/neverskip/types';
import { uiHomeworkId, uiNoticeId } from '@/lib/neverskip/ids';
import { parsePrefixedSourceId } from '@/lib/acknowledgement-ids';
import {
  acknowledgeAccessError,
  classesFromNoticeJson,
  listApprovedStudentClasses,
  parentHasApprovedLink,
  sectionsFromHomeworkJson,
} from '@/lib/parent-access';

export type SessionParent = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

export type MyAcknowledgements = {
  homework: Record<string, string>; // uiId -> ISO acknowledgedAt
  notices: Record<string, string>;
};

export async function getSessionParent(): Promise<SessionParent | null> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  const role = session?.user?.role;
  if (!id || !email || role !== PARENT_ROLE) return null;
  return {
    id,
    email,
    name: session.user.name,
    role,
  };
}

export async function resolveImportedHomework(
  uiOrDbId: string,
): Promise<{ id: string; source: string; sourceId: string } | null> {
  const prisma = getPrisma();
  const prefixed = parsePrefixedSourceId(uiOrDbId);
  if (prefixed) {
    const row = await prisma.importedHomework.findUnique({
      where: {
        source_sourceId: {
          source: prefixed.source,
          sourceId: prefixed.sourceId,
        },
      },
      select: { id: true, source: true, sourceId: true },
    });
    return row;
  }
  const row = await prisma.importedHomework.findUnique({
    where: { id: uiOrDbId },
    select: { id: true, source: true, sourceId: true },
  });
  return row;
}

export async function resolveImportedNotice(
  uiOrDbId: string,
): Promise<{ id: string; source: string; sourceId: string } | null> {
  const prisma = getPrisma();
  const prefixed = parsePrefixedSourceId(uiOrDbId);
  if (prefixed) {
    const row = await prisma.importedNotice.findUnique({
      where: {
        source_sourceId: {
          source: prefixed.source || NEVERSKIP_SOURCE,
          sourceId: prefixed.sourceId,
        },
      },
      select: { id: true, source: true, sourceId: true },
    });
    return row;
  }
  const row = await prisma.importedNotice.findUnique({
    where: { id: uiOrDbId },
    select: { id: true, source: true, sourceId: true },
  });
  return row;
}

export async function loadMyAcknowledgements(): Promise<MyAcknowledgements> {
  const parent = await getSessionParent();
  if (!parent) {
    return { homework: {}, notices: {} };
  }

  const prisma = getPrisma();
  const [hwRows, ntRows] = await Promise.all([
    prisma.homeworkAcknowledgement.findMany({
      where: { userId: parent.id },
      include: { homework: { select: { source: true, sourceId: true } } },
    }),
    prisma.noticeAcknowledgement.findMany({
      where: { userId: parent.id },
      include: { notice: { select: { source: true, sourceId: true } } },
    }),
  ]);

  const homework: Record<string, string> = {};
  for (const row of hwRows) {
    const key = uiHomeworkId(row.homework.sourceId, row.homework.source);
    homework[key] = row.acknowledgedAt.toISOString();
  }

  const notices: Record<string, string> = {};
  for (const row of ntRows) {
    const key = uiNoticeId(row.notice.sourceId, row.notice.source);
    notices[key] = row.acknowledgedAt.toISOString();
  }

  return { homework, notices };
}

export type AcknowledgeResult =
  | { ok: true; acknowledgedAt: string; uiId: string }
  | { ok: false; error: string };

export type ParentAccessSummary = {
  hasApprovedLink: boolean;
  approvedClassLabels: string[];
};

export async function loadParentAccess(): Promise<ParentAccessSummary> {
  const parent = await getSessionParent();
  if (!parent) {
    return { hasApprovedLink: false, approvedClassLabels: [] };
  }
  const approvedClassLabels = await listApprovedStudentClasses(
    getPrisma(),
    parent.id,
  );
  return {
    hasApprovedLink: parentHasApprovedLink(approvedClassLabels),
    approvedClassLabels,
  };
}

async function assertHomeworkAccess(
  parentId: string,
  homeworkId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const [approved, hw] = await Promise.all([
    listApprovedStudentClasses(prisma, parentId),
    prisma.importedHomework.findUnique({
      where: { id: homeworkId },
      select: { sectionsJson: true },
    }),
  ]);
  if (!hw) return 'Homework not found';
  return acknowledgeAccessError(approved, sectionsFromHomeworkJson(hw.sectionsJson));
}

async function assertNoticeAccess(
  parentId: string,
  noticeId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const [approved, nt] = await Promise.all([
    listApprovedStudentClasses(prisma, parentId),
    prisma.importedNotice.findUnique({
      where: { id: noticeId },
      select: { classesJson: true },
    }),
  ]);
  if (!nt) return 'Notice not found';
  return acknowledgeAccessError(approved, classesFromNoticeJson(nt.classesJson));
}

/** Ignore any client-supplied userId — session only. */
export async function acknowledgeHomework(
  uiOrDbId: string,
): Promise<AcknowledgeResult> {
  const parent = await getSessionParent();
  if (!parent) {
    return { ok: false, error: 'Sign in required' };
  }

  const item = await resolveImportedHomework(uiOrDbId);
  if (!item) {
    return { ok: false, error: 'Homework not found' };
  }

  const accessError = await assertHomeworkAccess(parent.id, item.id);
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const prisma = getPrisma();
  const row = await prisma.homeworkAcknowledgement.upsert({
    where: {
      userId_homeworkId: { userId: parent.id, homeworkId: item.id },
    },
    create: {
      userId: parent.id,
      homeworkId: item.id,
    },
    update: {},
  });

  return {
    ok: true,
    acknowledgedAt: row.acknowledgedAt.toISOString(),
    uiId: uiHomeworkId(item.sourceId, item.source),
  };
}

export async function unacknowledgeHomework(
  uiOrDbId: string,
): Promise<AcknowledgeResult> {
  const parent = await getSessionParent();
  if (!parent) {
    return { ok: false, error: 'Sign in required' };
  }

  const item = await resolveImportedHomework(uiOrDbId);
  if (!item) {
    return { ok: false, error: 'Homework not found' };
  }

  const accessError = await assertHomeworkAccess(parent.id, item.id);
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const prisma = getPrisma();
  await prisma.homeworkAcknowledgement.deleteMany({
    where: { userId: parent.id, homeworkId: item.id },
  });

  return {
    ok: true,
    acknowledgedAt: '',
    uiId: uiHomeworkId(item.sourceId, item.source),
  };
}

export async function acknowledgeNotice(
  uiOrDbId: string,
): Promise<AcknowledgeResult> {
  const parent = await getSessionParent();
  if (!parent) {
    return { ok: false, error: 'Sign in required' };
  }

  const item = await resolveImportedNotice(uiOrDbId);
  if (!item) {
    return { ok: false, error: 'Notice not found' };
  }

  const accessError = await assertNoticeAccess(parent.id, item.id);
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const prisma = getPrisma();
  const row = await prisma.noticeAcknowledgement.upsert({
    where: {
      userId_noticeId: { userId: parent.id, noticeId: item.id },
    },
    create: {
      userId: parent.id,
      noticeId: item.id,
    },
    update: {},
  });

  return {
    ok: true,
    acknowledgedAt: row.acknowledgedAt.toISOString(),
    uiId: uiNoticeId(item.sourceId, item.source),
  };
}

export async function unacknowledgeNotice(
  uiOrDbId: string,
): Promise<AcknowledgeResult> {
  const parent = await getSessionParent();
  if (!parent) {
    return { ok: false, error: 'Sign in required' };
  }

  const item = await resolveImportedNotice(uiOrDbId);
  if (!item) {
    return { ok: false, error: 'Notice not found' };
  }

  const accessError = await assertNoticeAccess(parent.id, item.id);
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const prisma = getPrisma();
  await prisma.noticeAcknowledgement.deleteMany({
    where: { userId: parent.id, noticeId: item.id },
  });

  return {
    ok: true,
    acknowledgedAt: '',
    uiId: uiNoticeId(item.sourceId, item.source),
  };
}

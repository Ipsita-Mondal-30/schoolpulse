import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  getSessionParent,
  resolveImportedHomework,
} from '@/app/actions/acknowledgements';
import {
  listApprovedStudentClasses,
  parentCanAccessHomework,
  sectionsFromHomeworkJson,
  ERR_NO_LINKED_CHILD,
  ERR_NOT_FOR_LINKED_CLASS,
} from '@/lib/parent-access';
import {
  generateHomeworkVideo,
  getHomeworkVideoStatus,
  VIDEO_STATUS,
} from '@/lib/ai/homework-video';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function authorizeHomework(id: string) {
  const parent = await getSessionParent();
  if (!parent) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const resolved = await resolveImportedHomework(id);
  if (!resolved) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const prisma = getPrisma();
  const row = await prisma.importedHomework.findUnique({
    where: { id: resolved.id },
    select: { id: true, sectionsJson: true, title: true, subjectName: true },
  });
  if (!row) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const approved = await listApprovedStudentClasses(prisma, parent.id);
  if (approved.length === 0) {
    return {
      error: NextResponse.json({ error: ERR_NO_LINKED_CHILD }, { status: 403 }),
    };
  }
  const ok = await parentCanAccessHomework(
    prisma,
    parent.id,
    sectionsFromHomeworkJson(row.sectionsJson),
  );
  if (!ok) {
    return {
      error: NextResponse.json({ error: ERR_NOT_FOR_LINKED_CLASS }, { status: 403 }),
    };
  }
  return { parent, homework: row };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const authz = await authorizeHomework(id);
  if ('error' in authz && authz.error) return authz.error;

  const status = await getHomeworkVideoStatus(authz.homework!.id);
  if (!status) {
    return NextResponse.json({ status: VIDEO_STATUS.PENDING });
  }
  return NextResponse.json(status);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const authz = await authorizeHomework(id);
  if ('error' in authz && authz.error) return authz.error;

  // Manual only — never auto-triggered. Long-running Veo call.
  const result = await generateHomeworkVideo(authz.homework!.id);
  return NextResponse.json(result);
}

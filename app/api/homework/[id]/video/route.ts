import { after, NextResponse } from 'next/server';
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
  enqueueHomeworkVideo,
  getHomeworkVideoStatus,
  processHomeworkVideoJob,
  VIDEO_STATUS,
} from '@/lib/ai/homework-video';

export const runtime = 'nodejs';
/** Background after() may continue briefly; Veo itself runs on the worker when possible. */
export const maxDuration = 60;

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

  const homeworkId = authz.homework!.id;
  const result = await enqueueHomeworkVideo(homeworkId);

  // Do not block the HTTP response on Veo (minutes). Process in after() when
  // VIDEO_PROCESS_INLINE is not "false". Oracle worker also drains QUEUED jobs.
  if (
    result.status !== VIDEO_STATUS.READY &&
    result.status !== VIDEO_STATUS.FAILED &&
    process.env.VIDEO_PROCESS_INLINE !== 'false'
  ) {
    after(() => {
      void processHomeworkVideoJob(homeworkId).catch((err) => {
        console.error('[SchoolPulse] background video job failed:', err);
      });
    });
  }

  return NextResponse.json(result);
}

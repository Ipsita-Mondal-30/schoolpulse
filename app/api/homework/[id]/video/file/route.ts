import { NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getPrisma } from '@/lib/prisma';
import {
  getSessionParent,
  resolveImportedHomework,
} from '@/app/actions/acknowledgements';
import {
  listApprovedStudentClasses,
  parentCanAccessHomework,
  sectionsFromHomeworkJson,
} from '@/lib/parent-access';
import { getVideoStorage } from '@/lib/ai/video-storage';
import { VIDEO_STATUS } from '@/lib/ai/homework-video';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const parent = await getSessionParent();
  if (!parent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await resolveImportedHomework(id);
  if (!resolved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const prisma = getPrisma();
  const homework = await prisma.importedHomework.findUnique({
    where: { id: resolved.id },
    select: { id: true, sectionsJson: true },
  });
  if (!homework) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const approved = await listApprovedStudentClasses(prisma, parent.id);
  if (approved.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ok = await parentCanAccessHomework(
    prisma,
    parent.id,
    sectionsFromHomeworkJson(homework.sectionsJson),
  );
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const video = await prisma.homeworkVideo.findUnique({
    where: { homeworkId: homework.id },
  });
  if (!video || video.status !== VIDEO_STATUS.READY) {
    return NextResponse.json({ error: 'Not ready' }, { status: 404 });
  }

  const storage = getVideoStorage();
  const key = `homework/${homework.id}.mp4`;
  const absolute = storage.resolveAbsolutePath(key);
  if (!existsSync(absolute)) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  const st = statSync(absolute);
  const nodeStream = createReadStream(absolute);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(st.size),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

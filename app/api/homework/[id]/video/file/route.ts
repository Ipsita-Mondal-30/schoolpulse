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
import { getVideoStorage, homeworkVideoStorageKey } from '@/lib/ai/video-storage';
import { VIDEO_STATUS } from '@/lib/ai/homework-video';
import { chunkedStream, parseByteRange, type ByteRange } from '@/lib/http/byte-range';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
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

  const key = homeworkVideoStorageKey(homework.id);
  const storage = getVideoStorage();
  const absolute = storage.resolveAbsolutePath(key);
  const rangeHeader = req.headers.get('range');

  // Prefer local disk (worker/dev); fall back to Neon-mirrored bytes (Vercel).
  if (existsSync(absolute)) {
    const size = statSync(absolute).size;
    const range = parseByteRange(rangeHeader, size);
    if (range === 'unsatisfiable') return unsatisfiable(size);
    const nodeStream = range
      ? createReadStream(absolute, { start: range.start, end: range.end })
      : createReadStream(absolute);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return videoResponse(webStream, size, range);
  }

  if (video.videoBytes && video.videoBytes.length > 0) {
    const bytes = new Uint8Array(video.videoBytes);
    const range = parseByteRange(rangeHeader, bytes.length);
    if (range === 'unsatisfiable') return unsatisfiable(bytes.length);
    const slice = range ? bytes.subarray(range.start, range.end + 1) : bytes;
    // Streamed so clips above Vercel's 4.5 MB buffered-response limit still play.
    return videoResponse(chunkedStream(slice), bytes.length, range);
  }

  return NextResponse.json({ error: 'File missing' }, { status: 404 });
}

function videoResponse(body: ReadableStream, size: number, range: ByteRange | null): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Length': String(range ? range.end - range.start + 1 : size),
  };
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  return new NextResponse(body, { status: range ? 206 : 200, headers });
}

function unsatisfiable(size: number): NextResponse {
  return new NextResponse(null, {
    status: 416,
    headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
  });
}

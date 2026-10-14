import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/** Serves newsletter PDFs stored in Neon; `/newsletters/:file` is rewritten here (next.config.ts). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILE_RE = /^[a-z0-9][a-z0-9._-]*\.pdf$/i;
const CHUNK = 256 * 1024;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!FILE_RE.test(file)) return new NextResponse('Not found', { status: 404 });

  const row = await getPrisma().importedNewsletterMonth.findFirst({
    where: { sourceDocumentUrl: `/newsletters/${file}`, status: 'VALID' },
    select: { pdfBytes: true, sourceContentHash: true },
  });
  if (!row?.pdfBytes) return new NextResponse('Not found', { status: 404 });

  const bytes = new Uint8Array(row.pdfBytes);
  // Streamed: Vercel's 4.5 MB function response limit does not apply to streams (PDFs are ~14 MB).
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += CHUNK) controller.enqueue(bytes.subarray(i, i + CHUNK));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      ETag: `"${row.sourceContentHash.slice(0, 32)}"`,
    },
  });
}

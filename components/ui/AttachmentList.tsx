import { Paperclip } from 'lucide-react';

export type AttachmentLink = { url: string; name?: string };

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i;

function fileLabel(a: AttachmentLink, index: number): string {
  if (a.name) return a.name;
  try {
    const last = decodeURIComponent(new URL(a.url).pathname.split('/').pop() || '');
    if (last) return last;
  } catch {
    /* fall through */
  }
  return `Attachment ${index + 1}`;
}

/** Source attachments as safe external links; images render as thumbnails. */
export function AttachmentList({
  attachments,
  fallbackUrl,
}: {
  attachments?: AttachmentLink[];
  fallbackUrl?: string;
}) {
  const list = (attachments?.length ? attachments : fallbackUrl ? [{ url: fallbackUrl }] : []).filter(
    (a) => /^https?:\/\//i.test(a.url),
  );
  if (list.length === 0) return null;
  return (
    <ul className="space-y-2">
      {list.map((a, i) => (
        <li key={a.url}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-[var(--sp-primary)] hover:underline sp-focus"
          >
            {IMAGE_RE.test(a.url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.url}
                alt={a.name || 'Attachment'}
                className="max-h-64 w-auto rounded-xl border border-[var(--sp-border)]"
              />
            ) : (
              <>
                <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{fileLabel(a, i)}</span>
              </>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

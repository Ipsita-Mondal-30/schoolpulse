import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

export function NoticeItem({
  title,
  preview,
  dateLabel,
  href = '/notices',
  isNew,
  onClick,
}: {
  title: string;
  preview?: string;
  dateLabel?: string;
  href?: string;
  isNew?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--sp-ink)] leading-snug line-clamp-2">
            {title}
          </p>
          {isNew ? <StatusBadge tone="primary">New</StatusBadge> : null}
        </div>
        {preview ? (
          <p className="text-sm text-[var(--sp-muted)] mt-0.5 leading-snug line-clamp-2">{preview}</p>
        ) : null}
        {dateLabel ? <p className="sp-meta mt-1.5">{dateLabel}</p> : null}
      </div>
    </div>
  );

  const className =
    'block w-full text-left rounded-xl px-3.5 py-3 hover:bg-[var(--sp-primary-soft)]/60 transition-colors border-b border-[var(--sp-border)] last:border-0 sp-focus';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

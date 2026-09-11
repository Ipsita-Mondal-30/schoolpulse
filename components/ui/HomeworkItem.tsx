import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

export function HomeworkItem({
  subject,
  title,
  dueLabel,
  href = '/homework',
  status,
  onClick,
}: {
  subject: string;
  title: string;
  dueLabel?: string;
  href?: string;
  status?: 'today' | 'overdue' | 'upcoming' | null;
  onClick?: () => void;
}) {
  const tone =
    status === 'overdue' ? 'error' : status === 'today' ? 'warn' : status === 'upcoming' ? 'default' : null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--sp-ink)] leading-snug">{subject}</p>
          <p className="text-sm text-[var(--sp-muted)] mt-0.5 leading-snug line-clamp-2">{title}</p>
        </div>
        {tone && dueLabel ? (
          <StatusBadge tone={tone}>{dueLabel}</StatusBadge>
        ) : dueLabel ? (
          <span className="sp-meta shrink-0">{dueLabel}</span>
        ) : null}
      </div>
    </>
  );

  const className =
    'block w-full text-left rounded-xl px-3.5 py-3 hover:bg-[var(--sp-primary-soft)]/60 transition-colors sp-focus';

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

import Link from 'next/link';
import type { ReactNode } from 'react';

export function QuickAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center min-h-10 px-3.5 rounded-xl border border-[var(--sp-border)] bg-white text-sm font-semibold text-[var(--sp-ink)] hover:border-orange-200 hover:text-[var(--sp-primary)] hover:bg-[var(--sp-primary-soft)] transition-colors sp-focus"
    >
      {children}
    </Link>
  );
}

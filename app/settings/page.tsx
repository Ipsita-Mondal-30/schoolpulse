'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSyncedChildSection } from '@/lib/queries/synced-child';

function classLine(section: string): string {
  if (!section.includes('-')) return `Section ${section}`;
  const [klass, letter] = section.split('-');
  return `Class ${klass} · Section ${letter}`;
}

export default function SettingsPage() {
  const { section, studentName, hasApprovedLink } = useSyncedChildSection();

  return (
    <div className="sp-page">
      <PageHeader title="Settings" subtitle="How SchoolPulse shows your child’s class" />

      <p className="text-sm text-[var(--sp-ink)]">
        {hasApprovedLink && studentName ? (
          <>
            Showing updates for <span className="font-semibold">{studentName}</span>
            <span className="text-[var(--sp-muted)]"> · {classLine(section)}</span>
          </>
        ) : (
          <>
            Showing <span className="font-semibold">your child&apos;s schoolwork</span>
          </>
        )}
      </p>

      <p className="sp-meta mt-6">
        Acknowledgements mean you have seen an item. They do not mean homework is complete.
      </p>

      <Link
        href="/profile"
        className="mt-6 inline-block text-sm font-semibold text-[var(--sp-primary)] hover:underline"
      >
        Profile and sign out
      </Link>
    </div>
  );
}

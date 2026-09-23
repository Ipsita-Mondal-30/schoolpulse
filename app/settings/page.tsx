'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  return (
    <div className="sp-page">
      <PageHeader title="Settings" subtitle="How SchoolPulse shows your child’s class" />

      <p className="text-sm text-[var(--sp-ink)]">
        Showing <span className="font-semibold">Class 1 · Section A</span>
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

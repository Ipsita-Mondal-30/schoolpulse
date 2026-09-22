'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ProfilePage() {
  const { data: session, status } = useSession();

  return (
    <div className="sp-page">
      <PageHeader title="Profile" subtitle="Your SchoolPulse account" />

      {status === 'loading' ? (
        <p className="sp-meta">Loading…</p>
      ) : session?.user ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-4">
            <p className="text-sm font-semibold text-[var(--sp-ink)]">
              {session.user.name || 'Parent'}
            </p>
            <p className="sp-meta mt-1">{session.user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="min-h-11 rounded-xl border border-[var(--sp-border)] px-4 text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-bg)] sp-focus"
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--sp-primary)] px-4 text-sm font-semibold text-white hover:bg-orange-600 sp-focus"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}

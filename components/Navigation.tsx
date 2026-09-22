'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { DesktopNavigation } from '@/components/nav/DesktopNavigation';
import { BottomNavigation } from '@/components/nav/BottomNavigation';
import { useUpdates } from '@/context/UpdatesContext';

function MobileUpdatesLink() {
  const { updatesCount } = useUpdates();
  return (
    <Link
      href="/updates"
      className="relative rounded-lg p-2 text-[var(--sp-muted)] hover:bg-white sp-focus"
      aria-label="Updates"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {updatesCount > 0 ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
      ) : null}
    </Link>
  );
}

export default function Navigation() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--sp-border)] bg-[var(--sp-bg)]/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex h-14 w-full min-w-0 items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5 rounded-lg sp-focus">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sp-primary)] text-xs font-bold text-white"
              aria-hidden
            >
              SP
            </span>
            <span className="text-sm font-bold tracking-tight text-[var(--sp-ink)]">
              SchoolPulse
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <MobileUpdatesLink />
          </div>
        </div>
      </header>

      <DesktopNavigation />
      <BottomNavigation />
    </>
  );
}

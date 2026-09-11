'use client';

import Link from 'next/link';
import { DesktopNavigation } from '@/components/nav/DesktopNavigation';
import { BottomNavigation } from '@/components/nav/BottomNavigation';
import RecentUpdates from '@/components/RecentUpdates';

export default function Navigation() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--sp-border)] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] min-w-0 items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-lg sp-focus"
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sp-primary)] text-xs font-bold text-white"
              aria-hidden
            >
              SP
            </span>
            <span className="text-sm font-bold tracking-tight text-[var(--sp-primary)] sm:text-base">
              SchoolPulse
            </span>
          </Link>

          <DesktopNavigation />

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <RecentUpdates />
          </div>
        </div>
      </header>

      <BottomNavigation />
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Home,
  LayoutGrid,
} from 'lucide-react';
import { useUpdates } from '@/context/UpdatesContext';
import RecentUpdates from '@/components/RecentUpdates';

export const DESKTOP_PRIMARY = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/homework', label: 'Homework', icon: BookOpen },
  { href: '/this-week', label: 'This Week', icon: CalendarRange },
  { href: '/notices', label: 'Notices', icon: Bell },
  { href: '/more', label: 'More', icon: LayoutGrid },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const { homeworkCount } = useUpdates();
  const { data: session, status } = useSession();

  return (
    <div className="hidden md:flex items-center gap-3 min-w-0 flex-1">
      <nav
        className="flex min-w-0 flex-1 items-center justify-center gap-0.5 lg:gap-1"
        aria-label="Main"
      >
        {DESKTOP_PRIMARY.map((link) => {
          const Icon = link.icon;
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sp-focus ${
                active
                  ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary)] font-semibold'
                  : 'text-[var(--sp-muted)] hover:bg-[var(--sp-bg)] hover:text-[var(--sp-ink)]'
              }`}
            >
              <Icon className="hidden lg:block h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>{link.label}</span>
              {link.href === '/homework' && homeworkCount > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sp-error)] px-1 text-[10px] font-bold text-white">
                  {homeworkCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2 border-l border-[var(--sp-border)] pl-3">
        <RecentUpdates />
        {status === 'authenticated' && session?.user?.email ? (
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--sp-muted)] hover:bg-[var(--sp-primary-soft)] hover:text-[var(--sp-primary)] sp-focus"
            title={session.user.email}
          >
            Sign out
          </button>
        ) : status !== 'loading' ? (
          <Link
            href="/login"
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--sp-primary)] hover:bg-[var(--sp-primary-soft)] sp-focus"
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}

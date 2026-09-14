'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Home,
  LayoutGrid,
} from 'lucide-react';
import { useUpdates } from '@/context/UpdatesContext';

export const DESKTOP_PRIMARY = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/homework', label: 'Homework', icon: BookOpen },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/updates', label: 'Updates', icon: Bell },
  { href: '/more', label: 'More', icon: LayoutGrid },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const { updatesCount } = useUpdates();
  const { data: session } = useSession();

  const displayName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    (session?.user?.email ? session.user.email.split('@')[0] : 'Parent');
  const initial = displayName.slice(0, 1).toUpperCase();
  const roleLabel = session?.user?.role === 'parent' ? 'Parent' : session?.user ? 'Signed in' : 'Guest';

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col bg-[var(--sp-bg)] px-5 py-6 md:flex"
      aria-label="Main"
    >
      <Link href="/" className="mb-10 flex items-center gap-2.5 rounded-lg sp-focus">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--sp-primary)] text-[11px] font-bold text-white"
          aria-hidden
        >
          SP
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-[var(--sp-ink)]">
          SchoolPulse
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {DESKTOP_PRIMARY.map((link) => {
          const Icon = link.icon;
          const active = isActivePath(pathname, link.href);
          const showDot = link.href === '/updates' && updatesCount > 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] transition-colors sp-focus ${
                active
                  ? 'bg-[var(--sp-primary-soft)] font-medium text-[var(--sp-ink)]'
                  : 'font-normal text-[var(--sp-muted)] hover:bg-white/70 hover:text-[var(--sp-ink)]'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.75} aria-hidden />
              <span className="flex-1">{link.label}</span>
              {showDot ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="New updates" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Link
        href={session?.user ? '/profile' : '/login'}
        className="mt-auto flex items-center gap-3 rounded-2xl px-1 py-2 sp-focus hover:bg-white/70"
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sp-primary)] text-sm font-semibold text-white"
          aria-hidden
        >
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--sp-ink)]">
            {displayName}
          </span>
          <span className="block text-xs text-[var(--sp-muted)]">{roleLabel}</span>
        </span>
      </Link>
    </aside>
  );
}

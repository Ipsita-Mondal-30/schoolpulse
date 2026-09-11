'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  Home,
  LayoutGrid,
} from 'lucide-react';
import { useUpdates } from '@/context/UpdatesContext';

const BOTTOM_LINKS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  {
    href: '/homework',
    label: 'Homework',
    icon: BookOpen,
    match: (p: string) => p.startsWith('/homework'),
  },
  {
    href: '/this-week',
    label: 'This Week',
    icon: CalendarRange,
    match: (p: string) => p.startsWith('/this-week'),
  },
  {
    href: '/planner',
    label: 'Planner',
    icon: CalendarDays,
    match: (p: string) => p.startsWith('/planner'),
  },
  {
    href: '/more',
    label: 'More',
    icon: LayoutGrid,
    match: (p: string) => p.startsWith('/more'),
  },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const { homeworkCount } = useUpdates();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--sp-border)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 h-14">
        {BOTTOM_LINKS.map((link) => {
          const Icon = link.icon;
          const active = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold sp-focus ${
                active ? 'text-[var(--sp-primary)]' : 'text-[var(--sp-muted)]'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              <span>{link.label}</span>
              {link.href === '/homework' && homeworkCount > 0 ? (
                <span className="absolute top-1 right-[22%] flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-[var(--sp-error)] text-[8px] font-bold text-white">
                  {homeworkCount}
                </span>
              ) : null}
              {active ? (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[var(--sp-primary)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

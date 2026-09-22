'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  Bus,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  Info,
  Library,
  Settings,
  Type,
  UserRound,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const MORE_LINKS = [
  { href: '/this-week', label: 'This Week', description: 'How busy the week looks', icon: CalendarRange },
  { href: '/timetable', label: 'Timetable', description: 'Today’s class periods', icon: ClipboardList },
  { href: '/class-diary', label: 'Library', description: 'Class diary & content', icon: Library },
  { href: '/joy-of-learning', label: 'JoL', description: 'Joy of Learning', icon: GraduationCap },
  { href: '/week', label: 'Words', description: 'Weekly vocabulary', icon: Type },
  { href: '/info#teachers', label: 'Teacher contacts', description: 'Reach class teachers', icon: Users },
  { href: '/info', label: 'School information', description: 'About the school', icon: Info },
  { href: '/info#bus', label: 'Bus', description: 'Transport details', icon: Bus },
  { href: '/profile', label: 'Profile', description: 'Your account', icon: UserRound },
  { href: '/settings', label: 'Settings', description: 'Class and display preferences', icon: Settings },
] as const;

export default function MorePage() {
  const { data: session, status } = useSession();

  return (
    <div className="sp-page">
      <PageHeader
        title="More"
        subtitle="Secondary tools, in one list."
      />

      <ul className="divide-y divide-[var(--sp-border)] border-y border-[var(--sp-border)]">
        {MORE_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-3 py-3.5 transition-colors hover:bg-[var(--sp-primary-soft)]/40 sp-focus"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sp-bg)] text-[var(--sp-primary)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--sp-ink)]">
                    {link.label}
                  </span>
                  <span className="block text-xs text-[var(--sp-muted)]">
                    {link.description}
                  </span>
                </span>
                <span className="text-[var(--sp-subtle)]" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        {status === 'authenticated' && session?.user?.email ? (
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="min-h-11 w-full rounded-xl border border-[var(--sp-border)] text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-bg)] sp-focus"
          >
            Sign out
          </button>
        ) : status !== 'loading' ? (
          <Link
            href="/login"
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--sp-primary)] text-sm font-semibold text-white hover:bg-orange-600 sp-focus"
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}

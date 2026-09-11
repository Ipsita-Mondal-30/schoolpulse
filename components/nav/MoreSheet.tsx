'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Bell,
  Bus,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Info,
  Library,
  Sparkles,
  Type,
  Users,
  X,
} from 'lucide-react';

const MORE_LINKS = [
  { href: '/timetable', label: 'Timetable', icon: ClipboardList },
  { href: '/notices', label: 'Notices', icon: Bell },
  { href: '/week', label: 'Words', icon: Type },
  { href: '/joy-of-learning', label: 'Joy of Learning', icon: GraduationCap },
  { href: '/class-diary', label: 'Library', icon: Library },
  { href: '/changes', label: 'Something Changed', icon: Sparkles },
  { href: '/dates', label: 'Events', icon: CalendarDays },
  { href: '/info', label: 'School info', icon: Info },
  { href: '/info#teachers', label: 'Teacher contacts', icon: Users },
  { href: '/info#bus', label: 'Bus information', icon: Bus },
] as const;

export function MoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--sp-ink)]/30"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-[var(--sp-border)] bg-white pb-[calc(3.5rem+env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--sp-border)] bg-white px-4 pb-2 pt-4">
          <h2 className="text-base font-bold text-[var(--sp-ink)]">More</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--sp-muted)] hover:bg-[var(--sp-bg)] sp-focus"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="px-2 py-2">
          {MORE_LINKS.map((link) => {
            const Icon = link.icon;
            const base = link.href.split('#')[0];
            const active = pathname === base;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium sp-focus ${
                    active
                      ? 'bg-[var(--sp-primary-soft)] text-[var(--sp-primary)]'
                      : 'text-[var(--sp-ink)] hover:bg-[var(--sp-bg)]'
                  }`}
                >
                  <Icon className="h-4 w-4 opacity-70" aria-hidden />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-[var(--sp-border)] px-4 py-3">
          {status === 'authenticated' && session?.user?.email ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                void signOut({ callbackUrl: '/' });
              }}
              className="min-h-11 w-full rounded-xl border border-[var(--sp-border)] text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-bg)] sp-focus"
            >
              Sign out
            </button>
          ) : status !== 'loading' ? (
            <Link
              href="/login"
              onClick={onClose}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--sp-primary)] text-sm font-semibold text-white hover:bg-orange-600 sp-focus"
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

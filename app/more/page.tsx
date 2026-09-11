import Link from 'next/link';
import {
  Bus,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Info,
  Library,
  Sparkles,
  Type,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const MORE_LINKS = [
  { href: '/timetable', label: 'Timetable', description: 'Today’s class periods', icon: ClipboardList },
  { href: '/week', label: 'Words', description: 'Weekly vocabulary', icon: Type },
  { href: '/joy-of-learning', label: 'Joy of Learning', description: 'JoL activities', icon: GraduationCap },
  { href: '/class-diary', label: 'Library', description: 'Class diary & content', icon: Library },
  { href: '/changes', label: 'Something changed', description: 'Recent homework & notice updates', icon: Sparkles },
  { href: '/dates', label: 'Events', description: 'School calendar highlights', icon: CalendarDays },
  { href: '/info', label: 'School information', description: 'About the school', icon: Info },
  { href: '/info#teachers', label: 'Teacher contacts', description: 'Reach class teachers', icon: Users },
  { href: '/info#bus', label: 'Bus information', description: 'Transport details', icon: Bus },
] as const;

export default function MorePage() {
  return (
    <div className="sp-page">
      <PageHeader
        title="More"
        subtitle="Everything else, in one calm list."
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
    </div>
  );
}

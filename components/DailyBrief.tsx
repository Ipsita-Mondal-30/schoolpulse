'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  Library,
} from 'lucide-react';
import { buildAttentionItems, formatBriefDate, getBriefGreeting, getIndiaHour } from '@/lib/daily-brief';
import { buildDailyPulse } from '@/lib/daily-pulse';
import { getDaySchedule } from '@/lib/data';
import {
  formatHolidayDateLine,
  getConfirmedSchoolHoliday,
  getUpcomingSchoolEvents,
} from '@/lib/school-day';
import { useDailyBriefQuery } from '@/lib/queries/daily-brief';
import { useUpdatesFeedQuery } from '@/lib/queries/updates';
import { useParentAccessQuery } from '@/lib/queries/acknowledgements';
import { LoadingState } from '@/components/ui/LoadingState';
import TodaysRecapHomeCard from '@/components/recap/TodaysRecapHomeCard';
import { countUnreadUpdates, filterUpdatesBySection } from '@/lib/updates-feed';
import { readLastSeenIso } from '@/lib/updates-unread';

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

function formatLongDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

function classLine(section: string): string {
  if (!section.includes('-')) return `Section ${section}`;
  const [klass, letter] = section.split('-');
  return `Class ${klass} ${letter}`;
}

export default function DailyBrief() {
  const { data: session } = useSession();
  const isParent = session?.user?.role === 'parent';
  const { data: access } = useParentAccessQuery(Boolean(isParent));
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [greeting, setGreeting] = useState('Good evening');
  const [todayYmd, setTodayYmd] = useState('');
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  const [pulse, setPulse] = useState(() => buildDailyPulse());
  const { data, isPending, isError, refetch } = useDailyBriefQuery({ section });
  const { data: updatesFeed } = useUpdatesFeedQuery();

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) setSection(saved);
    setGreeting(getBriefGreeting(getIndiaHour()));
    setTodayYmd(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
    setPulse(buildDailyPulse());
    const tick = setInterval(() => setPulse(buildDailyPulse()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const lastSeen = readLastSeenIso();
    const forSection = filterUpdatesBySection(updatesFeed ?? [], section);
    setUnreadUpdates(countUnreadUpdates(forSection, lastSeen));
  }, [updatesFeed, section]);

  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    (session?.user?.email ? session.user.email.split('@')[0] : '');

  const childName = access?.studentName?.trim() || '';
  const childLabel = childName || classLine(section);
  const childInitial = (childName || classLine(section)).slice(0, 1).toUpperCase();

  const attention = useMemo(() => {
    if (!data) return [];
    return buildAttentionItems(data, { unreadUpdates });
  }, [data, unreadUpdates]);

  if (isPending || !data) {
    return (
      <div className="sp-page max-w-3xl">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page max-w-3xl">
        <p className="text-sm font-semibold text-[var(--sp-ink)]">
          Couldn&apos;t load today&apos;s brief.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 rounded-xl bg-[var(--sp-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 sp-focus"
        >
          Retry
        </button>
      </div>
    );
  }

  const attentionCount = attention.length;
  const holiday = getConfirmedSchoolHoliday(
    data.today,
    data.calendarItems,
    getDaySchedule(data.today),
  );
  const upcomingEvents = holiday
    ? getUpcomingSchoolEvents(data.today, data.calendarItems)
    : [];
  const pulseStart = pulse.markers[0]?.minutes ?? 0;
  const pulseEnd = pulse.markers.at(-1)?.minutes ?? 1;
  const pulseSpan = Math.max(pulseEnd - pulseStart, 1);

  return (
    <div className="sp-page max-w-3xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--sp-muted)]">
            {todayYmd ? formatLongDate(todayYmd) : 'Today'}
          </p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight text-[var(--sp-ink)] sm:text-[2.25rem]">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
            {firstName ? ' 👋' : ''}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sp-primary)] text-base font-semibold text-white">
            {childInitial}
          </span>
          <p className="text-sm font-medium text-[var(--sp-ink)]">{childLabel}</p>
          <p className="text-xs text-[var(--sp-muted)]">{classLine(section)}</p>
        </div>
      </header>

      {holiday ? (
        <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
            Today
          </p>
          <p className="mt-2 text-sm text-[var(--sp-muted)]">
            {formatHolidayDateLine(data.today)}
          </p>
          <p className="mt-4 text-lg font-semibold text-[var(--sp-ink)]">🎉 School holiday</p>
          <p className="mt-1 text-base font-medium text-[var(--sp-ink)]">{holiday.name}</p>
          <p className="mt-2 text-sm text-[var(--sp-muted)]">No classes today.</p>
          {upcomingEvents.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
              {upcomingEvents.map((item) => (
                <li key={`${item.date}-${item.event}`}>
                  <Link
                    href="/planner"
                    className="flex items-center justify-between gap-3 rounded-xl sp-focus"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-[var(--sp-ink)]">
                      {item.event}
                    </span>
                    <span className="shrink-0 text-sm text-[var(--sp-muted)]">
                      {formatBriefDate(item.date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section className="rounded-[28px] bg-white px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
            Daily pulse
          </p>
          <div className="relative h-2 rounded-full bg-zinc-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--sp-primary)]"
              style={{ width: `${Math.round(pulse.progress * 100)}%` }}
            />
          </div>
          <div className="relative mt-4 min-h-[3.25rem]">
            {pulse.markers.map((marker) => {
              const left = ((marker.minutes - pulseStart) / pulseSpan) * 100;
              return (
                <div
                  key={`${marker.kind}-${marker.minutes}`}
                  className="absolute top-0 w-24 -translate-x-1/2 text-center"
                  style={{ left: `${left}%` }}
                >
                  {marker.kind === 'now' ? (
                    <span className="mx-auto mb-1 block h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--sp-primary)] shadow" />
                  ) : null}
                  <p className="text-[11px] font-semibold text-[var(--sp-ink)]">{marker.timeLabel}</p>
                  <p className="text-[10px] text-[var(--sp-muted)]">
                    {marker.kind === 'now' ? 'Now' : marker.caption}
                  </p>
                </div>
              );
            })}
          </div>
          {pulse.isWeekend ? (
            <p className="mt-2 text-xs text-[var(--sp-muted)]">School is off today.</p>
          ) : null}
        </section>
      )}

      <section className="rounded-[28px] bg-[#141414] px-5 py-5 text-white">
        {attentionCount === 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Today
            </p>
            <p className="mt-3 text-sm text-white/80">You&apos;re all caught up.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {attentionCount} thing{attentionCount === 1 ? '' : 's'} need your attention
            </p>
            <ul className="space-y-3.5">
              {attention.map((item) => {
                const urgent = item.kind === 'overdue';
                return (
                  <li key={item.id}>
                    <Link href={item.href} className="flex items-center gap-3 rounded-xl sp-focus">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          urgent ? 'bg-red-400' : 'bg-[var(--sp-primary)]'
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.title}
                      </span>
                      {item.kind === 'notice' ? (
                        <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--sp-primary)]">
                          {item.meta}
                          <ChevronRight className="h-4 w-4 text-white/40" aria-hidden />
                        </span>
                      ) : (
                        <span className="shrink-0 text-sm text-[var(--sp-primary)]">
                          {item.meta}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <TodaysRecapHomeCard section={section} todayYmd={data.today || todayYmd} />

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
          Your school
        </p>

        <Link
          href="/homework"
          className="flex items-center justify-between rounded-[28px] bg-[#FFF6E8] px-5 py-5 sp-focus"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              Homework
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--sp-ink)]">
              {childName ? `See ${childName}’s schoolwork` : 'See schoolwork'}
            </p>
          </div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[var(--sp-primary)]">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
        </Link>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/this-week"
            className="rounded-[28px] bg-[#EEF4FF] px-5 py-5 sp-focus"
          >
            <div className="mb-6 flex justify-end text-sky-400">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              This week
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--sp-ink)]">
              Workload at a glance
            </p>
          </Link>
          <Link
            href="/planner"
            className="rounded-[28px] bg-[#F3F0FF] px-5 py-5 sp-focus"
          >
            <div className="mb-6 flex justify-end text-violet-400">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              Planner
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--sp-ink)]">
              School dates & events
            </p>
          </Link>
        </div>

        <Link
          href="/updates"
          className="flex items-center justify-between rounded-[28px] bg-[#FFF1F2] px-5 py-5 sp-focus"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              Updates
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--sp-ink)]">
              {unreadUpdates > 0
                ? `${unreadUpdates} new update${unreadUpdates === 1 ? '' : 's'} since last visit`
                : 'Nothing new since last visit'}
            </p>
          </div>
          {unreadUpdates > 0 ? (
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-[var(--sp-ink)]">
              {unreadUpdates} new
            </span>
          ) : (
            <BookOpen className="h-5 w-5 text-rose-300" aria-hidden />
          )}
        </Link>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/timetable"
            className="rounded-[28px] bg-[#ECFDF5] px-5 py-5 sp-focus"
          >
            <div className="mb-6 flex justify-end text-emerald-400">
              <Clock className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              Timetable
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--sp-ink)]">
              Today’s schedule
            </p>
          </Link>
          <Link
            href="/class-diary"
            className="rounded-[28px] bg-[#FFFBEB] px-5 py-5 sp-focus"
          >
            <div className="mb-6 flex justify-end text-amber-400">
              <Library className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
              Library
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--sp-ink)]">
              Learning resources
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

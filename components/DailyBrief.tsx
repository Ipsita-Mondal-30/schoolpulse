'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  formatBriefDate,
  getBriefGreeting,
  getIndiaHour,
} from '@/lib/daily-brief';
import {
  formatRelativeTimeIndia,
  presentChangeLines,
  type FieldChange,
} from '@/lib/neverskip/changes';
import { useDailyBriefQuery } from '@/lib/queries/daily-brief';
import { useChangesQuery } from '@/lib/queries/changes';
import type { UiChangeItem } from '@/app/actions';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HomeworkItem } from '@/components/ui/HomeworkItem';
import { QuickAction } from '@/components/ui/QuickAction';
import { LoadingState } from '@/components/ui/LoadingState';

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

function toFieldChanges(item: UiChangeItem): FieldChange[] {
  return item.changedFields.map((c) => ({
    field: c.field,
    label: c.label,
    previous: c.previous,
    current: c.current,
    reliable: c.reliable,
  }));
}

function formatLongDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
}

export default function DailyBrief() {
  const { data: session } = useSession();
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [greeting, setGreeting] = useState('Good evening');
  const [todayYmd, setTodayYmd] = useState('');
  const { data, isPending, isError, refetch } = useDailyBriefQuery({ section });
  const { data: changesData } = useChangesQuery();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) {
      setSection(saved);
    }
    setGreeting(getBriefGreeting(getIndiaHour()));
    setTodayYmd(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
  }, []);

  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    (session?.user?.email ? session.user.email.split('@')[0] : '');

  if (isPending) {
    return (
      <div className="sp-page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page">
        <p className="text-sm font-semibold text-[var(--sp-ink)]">
          Couldn&apos;t load today&apos;s brief.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 px-4 py-2 bg-[var(--sp-primary)] text-white text-sm font-semibold rounded-xl hover:bg-orange-600 sp-focus"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sp-page">
        <LoadingState rows={5} />
      </div>
    );
  }

  const dueTodayCount = data.dueToday.length;
  const noticeCount = data.recentNotices.length;
  const upNext = [...data.dueTomorrow, ...data.comingUp].slice(0, 4);
  const recentChanges = (changesData ?? []).slice(0, 3);
  const allCaughtUp =
    data.nothingUrgent &&
    data.dueToday.length === 0 &&
    data.overdue.length === 0 &&
    upNext.length === 0;

  return (
    <div className="sp-page space-y-8">
      <header>
        <p className="sp-meta mb-1">{todayYmd ? formatLongDate(todayYmd) : 'Today'}</p>
        <h1 className="sp-title">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="sp-subtitle">Here&apos;s what matters for your child today.</p>
      </header>

      <section>
        <SectionHeader label="Today" />
        {allCaughtUp ? (
          <EmptyState title="You're all caught up" description="No homework due today." />
        ) : (
          <div className="sp-card divide-y divide-[var(--sp-border)]">
            <Link
              href="/homework"
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--sp-primary-soft)]/50 transition-colors sp-focus rounded-t-2xl"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--sp-ink)]">Homework</p>
                <p className="sp-meta mt-0.5">
                  {dueTodayCount === 0
                    ? data.overdue.length > 0
                      ? `${data.overdue.length} overdue`
                      : 'Nothing due today'
                    : `${dueTodayCount} item${dueTodayCount === 1 ? '' : 's'} due today`}
                </p>
              </div>
              <span className="text-[var(--sp-subtle)]" aria-hidden>
                →
              </span>
            </Link>
            <Link
              href="/notices"
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--sp-primary-soft)]/50 transition-colors sp-focus rounded-b-2xl"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--sp-ink)]">Notices</p>
                <p className="sp-meta mt-0.5">
                  {noticeCount === 0
                    ? 'No recent notices'
                    : `${noticeCount} recent notice${noticeCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <span className="text-[var(--sp-subtle)]" aria-hidden>
                →
              </span>
            </Link>
          </div>
        )}

        {data.dueToday.length > 0 ? (
          <div className="mt-3 sp-card py-1">
            {data.dueToday.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                dueLabel="Due today"
                status="today"
                href="/homework"
              />
            ))}
          </div>
        ) : null}

        {data.overdue.length > 0 ? (
          <div className="mt-3">
            <SectionHeader label="Overdue" />
            <div className="sp-card py-1">
              {data.overdue.slice(0, 3).map((item) => (
                <HomeworkItem
                  key={item.id}
                  subject={item.subject}
                  title={item.title}
                  dueLabel={
                    item.submissionDate ? formatBriefDate(item.submissionDate) : 'Overdue'
                  }
                  status="overdue"
                  href="/homework"
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {upNext.length > 0 ? (
        <section>
          <SectionHeader label="Up next" />
          <div className="sp-card py-1">
            {upNext.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                dueLabel={
                  item.submissionDate ? formatBriefDate(item.submissionDate) : undefined
                }
                status="upcoming"
                href="/homework"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader
          label="Recently changed"
          action={
            <Link
              href="/changes"
              className="text-xs font-semibold text-[var(--sp-primary)] hover:underline sp-focus rounded"
            >
              See all
            </Link>
          }
        />
        {recentChanges.length === 0 ? (
          <EmptyState
            title="No recent changes"
            description="When homework or notices are updated, they show up here."
          />
        ) : (
          <div className="sp-card divide-y divide-[var(--sp-border)]">
            {recentChanges.map((item) => {
              const lines = presentChangeLines(item.type, toFieldChanges(item));
              const summary = lines[0]?.heading || item.title;
              return (
                <Link
                  key={item.id}
                  href={item.type === 'homework' ? '/homework' : '/notices'}
                  className="block px-4 py-3.5 hover:bg-[var(--sp-primary-soft)]/50 transition-colors sp-focus"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                        {item.type === 'homework' ? 'Homework updated' : 'Notice updated'}
                      </p>
                      <p className="text-sm font-semibold text-[var(--sp-ink)] mt-0.5 line-clamp-2">
                        {item.subject ? `${item.subject} · ` : ''}
                        {summary}
                      </p>
                    </div>
                    <time className="sp-meta shrink-0" dateTime={item.detectedAt}>
                      {formatRelativeTimeIndia(item.detectedAt)}
                    </time>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeader label="Quick access" />
        <div className="flex flex-wrap gap-2">
          <QuickAction href="/homework">Homework</QuickAction>
          <QuickAction href="/timetable">Timetable</QuickAction>
          <QuickAction href="/planner">Planner</QuickAction>
        </div>
        <p className="sp-meta mt-3">Section focus: {section}</p>
      </section>
    </div>
  );
}

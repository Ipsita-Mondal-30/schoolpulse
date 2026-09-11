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
  const attention = [...data.overdue, ...data.dueToday].slice(0, 6);
  const upNext = [...data.dueTomorrow, ...data.comingUp].slice(0, 4);
  const recentChanges = (changesData ?? []).slice(0, 3);

  const classLabel = section.includes('-')
    ? `Class ${section.split('-')[0]} · Section ${section.split('-')[1]}`
    : `Section ${section}`;

  return (
    <div className="sp-page space-y-9">
      <header className="space-y-2">
        <p className="sp-meta">{todayYmd ? formatLongDate(todayYmd) : 'Today'}</p>
        <h1 className="sp-title tracking-tight">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm font-medium text-[var(--sp-ink)]">{classLabel}</p>
        <p className="sp-subtitle">Your child&apos;s school day, simplified.</p>
      </header>

      <section>
        <SectionHeader label="Today" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/homework"
            className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--sp-primary)]/40 sp-focus"
          >
            <p className="sp-meta">Homework</p>
            <p className="mt-1 text-sm font-semibold text-[var(--sp-ink)]">
              {dueTodayCount === 0
                ? data.overdue.length > 0
                  ? `${data.overdue.length} overdue`
                  : 'Nothing due'
                : `${dueTodayCount} task${dueTodayCount === 1 ? '' : 's'}`}
            </p>
          </Link>
          <Link
            href="/notices"
            className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--sp-primary)]/40 sp-focus"
          >
            <p className="sp-meta">Notices</p>
            <p className="mt-1 text-sm font-semibold text-[var(--sp-ink)]">
              {noticeCount === 0 ? 'No recent' : `${noticeCount} recent`}
            </p>
          </Link>
        </div>
      </section>

      <section>
        <SectionHeader label="Needs your attention" />
        {attention.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Nothing needs action right now."
          />
        ) : (
          <div className="divide-y divide-[var(--sp-border)] border-y border-[var(--sp-border)]">
            {attention.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                dueLabel={
                  data.overdue.some((o) => o.id === item.id)
                    ? item.submissionDate
                      ? `Overdue · ${formatBriefDate(item.submissionDate)}`
                      : 'Overdue'
                    : 'Due today'
                }
                status={data.overdue.some((o) => o.id === item.id) ? 'overdue' : 'today'}
                href="/homework"
              />
            ))}
          </div>
        )}
      </section>

      {upNext.length > 0 ? (
        <section>
          <SectionHeader label="Up next" />
          <div className="divide-y divide-[var(--sp-border)] border-y border-[var(--sp-border)]">
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
            title="Nothing changed recently"
            description="When homework or notices are updated, they show up here."
          />
        ) : (
          <div className="divide-y divide-[var(--sp-border)] border-y border-[var(--sp-border)]">
            {recentChanges.map((item) => {
              const lines = presentChangeLines(item.type, toFieldChanges(item));
              const summary = lines[0]?.heading || item.title;
              return (
                <Link
                  key={item.id}
                  href={item.type === 'homework' ? '/homework' : '/notices'}
                  className="block py-3.5 transition-colors hover:bg-[var(--sp-primary-soft)]/40 sp-focus"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                        {item.type === 'homework' ? 'Homework updated' : 'Notice updated'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-[var(--sp-ink)]">
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
    </div>
  );
}

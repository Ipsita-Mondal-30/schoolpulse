'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  dueLabelForItem,
  type ThisWeekHomeworkItem,
} from '@/lib/this-week';
import {
  formatWeekdayHeading,
  formatWeekRangeLabel,
} from '@/lib/week-range';
import { useThisWeekQuery } from '@/lib/queries/this-week';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HomeworkItem } from '@/components/ui/HomeworkItem';
import { LoadingState } from '@/components/ui/LoadingState';

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

function dayLabel(ymd: string, isToday: boolean): string {
  const base = formatWeekdayHeading(ymd).split(',')[0]?.toUpperCase() || ymd;
  const dayNum = ymd.split('-')[2]?.replace(/^0/, '') || '';
  return isToday ? `${base} ${dayNum} · TODAY` : `${base} ${dayNum}`;
}

export default function ThisWeekPage() {
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [showAllUndated, setShowAllUndated] = useState(false);
  const { data, isPending, isError, refetch } = useThisWeekQuery({ section });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) setSection(saved);
  }, []);

  if (isPending) {
    return (
      <div className="sp-page">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page">
        <p className="text-sm font-semibold">Couldn&apos;t load this week&apos;s homework.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 px-4 py-2.5 bg-[var(--sp-primary)] text-white text-sm font-semibold rounded-xl sp-focus"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sp-page">
        <LoadingState rows={6} />
      </div>
    );
  }

  const undatedVisible = showAllUndated
    ? data.dateNotSpecified
    : data.dateNotSpecified.slice(0, 5);
  const undatedHidden = data.dateNotSpecified.length - undatedVisible.length;

  return (
    <div className="sp-page">
      <PageHeader
        title="This Week"
        subtitle={`${formatWeekRangeLabel(data.weekStart, data.weekEnd)} · ${data.section}`}
      />

      {data.overdueCount > 0 ? (
        <div className="mb-6 rounded-xl border border-red-100 bg-[var(--sp-error-soft)] px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--sp-error)]">Overdue</p>
            <p className="sp-meta mt-0.5">
              {data.overdueCount} assignment{data.overdueCount === 1 ? '' : 's'}
            </p>
          </div>
          <Link
            href="/homework"
            className="text-xs font-semibold text-[var(--sp-error)] hover:underline sp-focus rounded"
          >
            View
          </Link>
        </div>
      ) : null}

      {data.nothingDueThisWeek && data.overdueCount === 0 ? (
        <div className="mb-6">
          <EmptyState
            title={
              data.hasUndated
                ? 'Nothing with a deadline this week'
                : "You're all caught up"
            }
            description={
              data.hasUndated
                ? `${data.undatedCount} without a school-provided deadline.`
                : 'Nothing is due this week.'
            }
          />
        </div>
      ) : null}

      <section className="mb-8">
        <SectionHeader label="Weekly timeline" />
        <div className="space-y-0">
          {data.days.map((day) => {
            const empty = day.count === 0;
            return (
              <div
                key={day.date}
                className={`py-3 border-b border-[var(--sp-border)] last:border-0 ${
                  day.isToday ? 'bg-[var(--sp-primary-soft)]/40 -mx-2 px-2 rounded-xl border-0 mb-1' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className={`text-xs font-bold tracking-wide ${
                      day.isToday ? 'text-[var(--sp-primary)]' : 'text-[var(--sp-ink)]'
                    }`}
                  >
                    {dayLabel(day.date, day.isToday)}
                  </h3>
                  <span className="sp-meta">
                    {empty
                      ? 'Nothing due'
                      : `${day.count} task${day.count === 1 ? '' : 's'}`}
                  </span>
                </div>
                {!empty ? (
                  <div className="mt-2 space-y-0.5">
                    {day.items.map((item: ThisWeekHomeworkItem) => (
                      <HomeworkItem
                        key={item.id}
                        subject={item.subject}
                        title={item.title}
                        dueLabel={dueLabelForItem(item, data.today)}
                        href="/homework"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {data.dateNotSpecified.length > 0 ? (
        <section className="mb-6">
          <SectionHeader label="Date not specified" />
          <p className="sp-meta mb-2">No deadline provided by school</p>
          <div className="sp-card py-1">
            {undatedVisible.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                href="/homework"
              />
            ))}
          </div>
          {undatedHidden > 0 && !showAllUndated ? (
            <button
              type="button"
              onClick={() => setShowAllUndated(true)}
              className="mt-2 text-xs font-semibold text-[var(--sp-primary)] hover:underline sp-focus rounded"
            >
              Show {undatedHidden} more
            </button>
          ) : null}
        </section>
      ) : null}

      <Link
        href="/homework"
        className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold hover:bg-orange-600 sp-focus"
      >
        View all homework
      </Link>
    </div>
  );
}

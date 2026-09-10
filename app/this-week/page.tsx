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

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

function dayHeading(ymd: string): string {
  return formatWeekdayHeading(ymd).replace(', ', ' · ');
}

function HomeworkCard({
  item,
  today,
  compact,
}: {
  item: ThisWeekHomeworkItem;
  today: string;
  compact?: boolean;
}) {
  const dueLabel = dueLabelForItem(item, today);
  const showDescription =
    !compact &&
    Boolean(item.description?.trim()) &&
    item.description.trim() !== item.title.trim();

  return (
    <Link
      href="/homework"
      className="block rounded-xl border border-gray-100 bg-white px-3 py-2 hover:border-orange-200 hover:bg-orange-50/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    >
      <div className="font-bold text-sm text-gray-800 leading-snug break-words">
        {item.subject}
      </div>
      <div className="text-sm text-gray-600 mt-0.5 leading-snug line-clamp-2 break-words">
        {item.title}
      </div>
      {showDescription ? (
        <p className="text-xs text-gray-400 mt-1 line-clamp-1 break-words">
          {item.description}
        </p>
      ) : null}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-xs font-medium text-gray-500">{dueLabel}</span>
        {item.attachmentImage ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
            Attachment
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'urgent';
}) {
  const valueColor =
    tone === 'urgent'
      ? 'text-red-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`text-xl font-black leading-tight mt-0.5 ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 animate-pulse space-y-4">
      <div className="h-14 bg-gray-200 rounded-xl w-2/3" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="h-16 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-20 bg-gray-100 rounded-xl" />
      <div className="h-40 bg-gray-50 rounded-xl" />
    </div>
  );
}

export default function ThisWeekPage() {
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [showAllUndated, setShowAllUndated] = useState(false);
  const { data, isPending, isError, refetch } = useThisWeekQuery({ section });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) {
      setSection(saved);
    }
  }, []);

  if (isPending) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">
            Couldn&apos;t load this week&apos;s homework.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 px-4 py-2.5 min-h-11 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const showCaughtUp =
    data.nothingDueThisWeek && data.overdueCount === 0;

  const undatedVisible = showAllUndated
    ? data.dateNotSpecified
    : data.dateNotSpecified.slice(0, 5);
  const undatedHidden =
    data.dateNotSpecified.length - undatedVisible.length;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
      {/* Page header */}
      <header className="mb-4 sm:mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          This Week
        </h1>
        <p className="text-sm sm:text-base font-semibold text-gray-500 mt-0.5">
          {formatWeekRangeLabel(data.weekStart, data.weekEnd)}
          <span className="text-gray-300 font-medium"> · {data.section}</span>
        </p>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          What does your child need to do this week?
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <SummaryCard
          label="Due this week"
          value={String(data.totalDatedThisWeek)}
        />
        <SummaryCard
          label="Due tomorrow"
          value={String(data.dueTomorrowCount)}
          tone={data.dueTomorrowCount > 0 ? 'warn' : 'default'}
        />
        <SummaryCard
          label="Overdue"
          value={data.overdueCount > 0 ? String(data.overdueCount) : 'None'}
          tone={data.overdueCount > 0 ? 'urgent' : 'default'}
        />
      </div>

      {data.nextWeekCount > 0 && (
        <p className="text-xs text-gray-400 mb-4 -mt-2">
          {data.nextWeekCount} due next week.{' '}
          <Link
            href="/homework"
            className="text-orange-600 font-bold hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
          >
            View homework
          </Link>
        </p>
      )}

      {showCaughtUp && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-orange-50/40 px-4 py-5 text-center mb-5">
          <p className="text-base font-bold text-gray-800">
            {data.hasUndated
              ? 'Nothing with a deadline this week.'
              : "You're all caught up!"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {data.hasUndated
              ? `${data.undatedCount} ${
                  data.undatedCount === 1
                    ? "assignment doesn't"
                    : "assignments don't"
                } have a deadline provided by the school.`
              : 'Nothing is due this week.'}
          </p>
        </div>
      )}

      {/* Compact overdue — do not list all items */}
      {data.overdueCount > 0 && (
        <section
          aria-labelledby="overdue-heading"
          className="mb-5 rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />
              <h2
                id="overdue-heading"
                className="text-sm font-black text-red-800"
              >
                Overdue
              </h2>
            </div>
            <p className="text-xs text-red-700/80 mt-0.5 font-medium">
              {data.overdueCount}{' '}
              {data.overdueCount === 1 ? 'assignment' : 'assignments'}
            </p>
          </div>
          <Link
            href="/homework"
            className="shrink-0 px-3 py-2 min-h-10 rounded-lg bg-white border border-red-200 text-xs font-bold text-red-700 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            View overdue
          </Link>
        </section>
      )}

      {/* Mon–Sun timeline */}
      <section aria-labelledby="timeline-heading" className="mb-6">
        <h2
          id="timeline-heading"
          className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3"
        >
          Weekly timeline
        </h2>
        <div className="space-y-1">
          {data.days.map((day) => {
            const empty = day.count === 0;
            return (
              <div
                key={day.date}
                className={
                  empty
                    ? 'rounded-lg px-2.5 py-1.5'
                    : 'rounded-xl border border-gray-100 bg-white px-3 py-3 mb-2 shadow-sm'
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={
                      empty
                        ? 'text-[11px] font-bold uppercase tracking-wide text-gray-400'
                        : 'text-xs font-black uppercase tracking-wider text-gray-800'
                    }
                  >
                    {dayHeading(day.date)}
                    {day.isToday ? (
                      <span className="ml-1.5 text-[10px] font-bold text-orange-600 normal-case tracking-normal">
                        Today
                      </span>
                    ) : null}
                  </h3>
                  {empty ? (
                    <span className="text-[11px] text-gray-300 font-medium">
                      Nothing due
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">
                      {day.count}{' '}
                      {day.count === 1 ? 'assignment' : 'assignments'}
                      <span className="text-gray-300"> · </span>
                      {day.workload}
                    </span>
                  )}
                </div>
                {!empty && (
                  <div className="mt-2 space-y-1.5">
                    {day.items.map((item) => (
                      <HomeworkCard
                        key={item.id}
                        item={item}
                        today={data.today}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Date not specified */}
      {data.dateNotSpecified.length > 0 && (
        <section aria-labelledby="undated-heading" className="mb-6">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h2
              id="undated-heading"
              className="text-xs font-black uppercase tracking-wider text-gray-700"
            >
              Date not specified
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {data.undatedCount}{' '}
              {data.undatedCount === 1 ? 'assignment' : 'assignments'}
            </span>
          </div>
          <div className="h-px bg-gray-100 mb-2" />
          <p className="text-xs text-gray-500 mb-2">
            No deadline provided by school
          </p>
          <div className="space-y-1.5">
            {undatedVisible.map((item) => (
              <HomeworkCard
                key={item.id}
                item={item}
                today={data.today}
                compact
              />
            ))}
          </div>
          {undatedHidden > 0 && !showAllUndated && (
            <button
              type="button"
              onClick={() => setShowAllUndated(true)}
              className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded px-1 py-1"
            >
              Show {undatedHidden} more
            </button>
          )}
        </section>
      )}

      <Link
        href="/homework"
        className="inline-flex items-center justify-center w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        View all homework
      </Link>
    </div>
  );
}

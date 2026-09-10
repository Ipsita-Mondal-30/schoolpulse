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

function HomeworkCard({
  item,
  today,
}: {
  item: ThisWeekHomeworkItem;
  today: string;
}) {
  const dueLabel = dueLabelForItem(item, today);
  return (
    <Link
      href="/homework"
      className="block rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 hover:border-orange-200 hover:bg-orange-50/40 transition-colors"
    >
      <div className="font-bold text-sm text-gray-800 leading-snug">{item.subject}</div>
      <div className="text-sm text-gray-600 mt-0.5 leading-snug line-clamp-2">{item.title}</div>
      {item.description ? (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
      ) : null}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 animate-pulse space-y-4">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="h-32 bg-gray-100 rounded-2xl" />
      <div className="h-32 bg-gray-100 rounded-2xl" />
    </div>
  );
}

export default function ThisWeekPage() {
  const [section, setSection] = useState(DEFAULT_SECTION);
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
            className="mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const summaryLineParts: string[] = [];
  if (data.dueTomorrowCount > 0) {
    summaryLineParts.push(
      `${data.dueTomorrowCount} due tomorrow`,
    );
  }
  if (data.overdueCount > 0) {
    summaryLineParts.push(`${data.overdueCount} overdue`);
  } else {
    summaryLineParts.push('No overdue');
  }

  const showCaughtUp =
    data.nothingDueThisWeek && data.overdueCount === 0;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
          This Week
        </p>
        <h1 className="text-xl font-black text-gray-900 leading-tight">
          {formatWeekRangeLabel(data.weekStart, data.weekEnd)}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.totalDatedThisWeek}{' '}
          {data.totalDatedThisWeek === 1 ? 'assignment' : 'assignments'}
          <span className="text-gray-400"> · {data.section}</span>
        </p>
        <p className="text-sm text-gray-600 mt-0.5 font-medium">
          {summaryLineParts.join(' · ')}
        </p>
        {data.nextWeekCount > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            {data.nextWeekCount} due next week.{' '}
            <Link href="/homework" className="text-orange-600 font-bold hover:text-orange-700">
              View homework →
            </Link>
          </p>
        )}
      </div>

      {showCaughtUp && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-orange-50/40 px-4 py-6 text-center mb-5">
          <p className="text-base font-bold text-gray-800">
            {data.hasUndated
              ? 'Nothing with a deadline this week.'
              : "You're all caught up!"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {data.hasUndated
              ? `${data.undatedCount} ${data.undatedCount === 1 ? 'assignment doesn\'t' : 'assignments don\'t'} have a deadline provided by the school.`
              : 'Nothing is due this week.'}
          </p>
          <Link
            href="/homework"
            className="inline-block mt-3 text-sm font-bold text-orange-600 hover:text-orange-700"
          >
            View homework →
          </Link>
        </div>
      )}

      {/* Overdue */}
      {data.overdue.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Overdue · {data.overdueCount}
            </h2>
          </div>
          <div className="space-y-2">
            {data.overdue.map((item) => (
              <HomeworkCard key={item.id} item={item} today={data.today} />
            ))}
          </div>
        </section>
      )}

      {/* Mon–Sun timeline */}
      <div className="space-y-5 mb-5">
        {data.days.map((day) => (
          <section key={day.date}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-700">
                {formatWeekdayHeading(day.date)}
                {day.isToday ? (
                  <span className="ml-2 text-[10px] font-bold text-orange-600 normal-case tracking-normal">
                    Today
                  </span>
                ) : null}
              </h2>
              {day.count > 0 ? (
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">
                  {day.count} {day.count === 1 ? 'assignment' : 'assignments'} · {day.workload}
                </span>
              ) : null}
            </div>
            <div className="h-px bg-gray-200 mb-2" />
            {day.count === 0 ? (
              <p className="text-sm text-gray-400 py-1">Nothing due</p>
            ) : (
              <div className="space-y-2">
                {day.items.map((item) => (
                  <HomeworkCard key={item.id} item={item} today={data.today} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Date not specified */}
      {data.dateNotSpecified.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-1">
            Date not specified
          </h2>
          <div className="h-px bg-gray-200 mb-2" />
          <p className="text-xs text-gray-500 mb-2">
            {data.undatedCount}{' '}
            {data.undatedCount === 1 ? 'assignment' : 'assignments'} · No reliable due
            date provided
          </p>
          <div className="space-y-2">
            {data.dateNotSpecified.map((item) => (
              <HomeworkCard key={item.id} item={item} today={data.today} />
            ))}
          </div>
        </section>
      )}

      <Link
        href="/homework"
        className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200"
      >
        View all homework
      </Link>
    </div>
  );
}

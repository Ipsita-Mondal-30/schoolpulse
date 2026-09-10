'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatBriefDate,
  getBriefGreeting,
  getIndiaHour,
  type DailyBriefHomeworkItem,
  type DailyBriefNoticeItem,
} from '@/lib/daily-brief';
import { useDailyBriefQuery } from '@/lib/queries/daily-brief';

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

function HomeworkRow({ item }: { item: DailyBriefHomeworkItem }) {
  return (
    <Link
      href="/homework"
      className="block rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 hover:border-orange-200 hover:bg-orange-50/40 transition-colors"
    >
      <div className="font-bold text-sm text-gray-800 leading-snug">{item.subject}</div>
      <div className="text-sm text-gray-600 mt-0.5 leading-snug line-clamp-2">{item.title}</div>
      {item.submissionDate && (
        <div className="text-xs text-gray-500 mt-1 font-medium">
          Due: {formatBriefDate(item.submissionDate)}
        </div>
      )}
    </Link>
  );
}

function NoticeRow({ item }: { item: DailyBriefNoticeItem }) {
  return (
    <Link
      href="/notices"
      className="block rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 hover:border-orange-200 hover:bg-orange-50/40 transition-colors"
    >
      <div className="font-bold text-sm text-gray-800 leading-snug line-clamp-2">
        {item.summary || 'School notice'}
      </div>
      {item.date && (
        <div className="text-xs text-gray-500 mt-1 font-medium">
          {formatBriefDate(item.date)}
          {item.time && item.time !== '00:00' ? ` · ${item.time}` : ''}
        </div>
      )}
    </Link>
  );
}

function SectionHeader({
  label,
  tone,
}: {
  label: string;
  tone: 'urgent' | 'warn' | 'info' | 'neutral';
}) {
  const dot =
    tone === 'urgent'
      ? 'bg-red-500'
      : tone === 'warn'
        ? 'bg-amber-500'
        : tone === 'info'
          ? 'bg-sky-500'
          : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400">
        {label}
      </h3>
    </div>
  );
}

function DailyBriefSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
      <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="space-y-2">
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="h-16 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function DailyBrief() {
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [greeting, setGreeting] = useState('Good evening');
  const { data, isPending, isError, refetch } = useDailyBriefQuery({ section });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) {
      setSection(saved);
    }
    setGreeting(getBriefGreeting(getIndiaHour()));
  }, []);

  if (isPending) return <DailyBriefSkeleton />;

  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
        <p className="text-sm font-semibold text-gray-800">Couldn&apos;t load today&apos;s brief.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <DailyBriefSkeleton />;

  const hasAnyContent =
    data.overdue.length > 0 ||
    data.dueToday.length > 0 ||
    data.dueTomorrow.length > 0 ||
    data.comingUp.length > 0 ||
    data.recentHomework.length > 0 ||
    data.recentNotices.length > 0 ||
    data.calendarItems.length > 0;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
      <div className="mb-4">
        <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
          {greeting} 👋
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          Here&apos;s what needs attention today
          <span className="text-gray-400"> · {section}</span>
        </p>
      </div>

      {!hasAnyContent ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-orange-50/40 px-4 py-6 text-center">
          <p className="text-base font-bold text-gray-800">Nothing urgent tonight 🎉</p>
          <p className="text-sm text-gray-500 mt-1">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.nothingUrgent && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-orange-50/40 px-4 py-3 text-center mb-1">
                <p className="text-sm font-bold text-gray-800">Nothing urgent tonight 🎉</p>
                <p className="text-xs text-gray-500 mt-0.5">You&apos;re all caught up.</p>
              </div>
            )}

          {data.recentHomework.length > 0 && (
            <div>
              <SectionHeader label="Recent homework" tone="neutral" />
              <div className="space-y-2">
                {data.recentHomework.slice(0, 5).map((item) => (
                  <HomeworkRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {data.recentNotices.length > 0 && (
            <div>
              <SectionHeader label="Recent notices" tone="info" />
              <div className="space-y-2">
                {data.recentNotices.map((item) => (
                  <NoticeRow key={item.id} item={item} />
                ))}
              </div>
              <Link
                href="/notices"
                className="inline-block mt-2 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                Read notices →
              </Link>
            </div>
          )}

          {data.calendarItems.length > 0 && (
            <div>
              <SectionHeader label="School calendar" tone="info" />
              <div className="space-y-2">
                {data.calendarItems.map((item) => (
                  <div
                    key={`${item.date}-${item.event}`}
                    className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                  >
                    <div className="font-bold text-sm text-gray-800">{item.event}</div>
                    <div className="text-xs text-gray-500 mt-1 font-medium">
                      {formatBriefDate(item.date)}
                      {item.description ? ` · ${item.description}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.dueToday.length > 0 && (
            <div>
              <SectionHeader label="Due today" tone="urgent" />
              <div className="space-y-2">
                {data.dueToday.map((item) => (
                  <HomeworkRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {data.dueTomorrow.length > 0 && (
            <div>
              <SectionHeader label="Due tomorrow" tone="warn" />
              <div className="space-y-2">
                {data.dueTomorrow.map((item) => (
                  <HomeworkRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {data.comingUp.length > 0 && (
            <div>
              <SectionHeader label="Coming up" tone="neutral" />
              <div className="space-y-2">
                {data.comingUp.map((item) => (
                  <HomeworkRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {data.overdue.length > 0 && (
            <div>
              <SectionHeader label="Overdue" tone="urgent" />
              <div className="space-y-2">
                {data.overdue.map((item) => (
                  <HomeworkRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          <Link
            href="/homework"
            className="inline-flex items-center justify-center w-full sm:w-auto mt-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200"
          >
            View all homework
          </Link>
        </div>
      )}
    </section>
  );
}

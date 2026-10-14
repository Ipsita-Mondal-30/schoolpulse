'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import PlannerCalendar from '@/components/PlannerCalendar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { ImportantDate } from '@/lib/data';
import { getIndiaToday } from '@/lib/daily-brief';
import { useCanonicalScheduleQuery, usePlannerMonthQuery } from '@/lib/queries/schedule';

function defaultSelectedDate(year: number, monthName: string, dates: ImportantDate[]) {
  const today = getIndiaToday();
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  if (today.startsWith(prefix)) return today;

  const firstWithEvent = dates
    .map((d) => d.date)
    .filter((d) => d.startsWith(prefix))
    .sort()[0];
  if (firstWithEvent) return firstWithEvent;

  return `${prefix}-01`;
}

export default function PlannerPage() {
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const plannerQuery = usePlannerMonthQuery(requestedKey);
  const scheduleQuery = useCanonicalScheduleQuery();

  const view = plannerQuery.data;
  const monthData = view?.selected ?? null;
  const availableMonths = view?.months ?? [];
  const importantDates = useMemo(() => monthData?.importantDates ?? [], [monthData]);
  const planner = monthData?.monthlyPlanner ?? [];

  useEffect(() => {
    if (!monthData) return;
    setSelectedDate(defaultSelectedDate(monthData.year, monthData.month, monthData.importantDates));
  }, [monthData]);

  const monthIndex = useMemo(
    () => availableMonths.findIndex((m) => m.key === monthData?.key),
    [availableMonths, monthData],
  );

  const nsEvents = scheduleQuery.data?.events ?? [];
  const nsDocs = (scheduleQuery.data?.documents ?? []).filter(
    (d) => d.scheduleDocument || /timetable|newsletter/i.test(d.title),
  );

  if (!monthData) {
    return (
      <div className="sp-page">
        {plannerQuery.isPending ? (
          <LoadingState rows={4} />
        ) : (
          <EmptyState
            title="Planner not available"
            description="The monthly planner will appear here once the school newsletter is published."
          />
        )}
      </div>
    );
  }

  return (
    <div className="sp-page">
      {view?.missingCurrentMessage && !requestedKey ? (
        <p className="mb-4 rounded-2xl bg-[var(--sp-primary-soft)]/50 px-4 py-2 text-sm text-[var(--sp-muted)]">
          {view.missingCurrentMessage} Showing {monthData.month} {monthData.year}.
        </p>
      ) : null}

      <PlannerCalendar
        month={monthData.month}
        year={monthData.year}
        dates={importantDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        canGoPrev={monthIndex > 0}
        canGoNext={monthIndex >= 0 && monthIndex < availableMonths.length - 1}
        onPrevMonth={() => {
          if (monthIndex > 0) setRequestedKey(availableMonths[monthIndex - 1].key);
        }}
        onNextMonth={() => {
          if (monthIndex >= 0 && monthIndex < availableMonths.length - 1) {
            setRequestedKey(availableMonths[monthIndex + 1].key);
          }
        }}
      />

      <div className="mt-10 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="sp-section tracking-[0.12em]">NeverSkip schedule</h2>
          <Link href="/timetable" className="text-sm font-semibold text-[var(--sp-primary)] hover:underline">
            Timetable →
          </Link>
        </div>
        <p className="text-xs text-[var(--sp-muted)]">
          Same schedule source as Joy of Learning and Timetable.
        </p>
        {nsEvents.length === 0 && nsDocs.length === 0 ? (
          <EmptyState
            title="No schedule events yet"
            description="When the school publishes calendar or timetable dates, they appear here and on Timetable / Joy of Learning."
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
            {nsEvents.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
              >
                <span className="text-sm text-[var(--sp-ink)]">{row.subjectName || row.title}</span>
                <span className="text-sm text-[var(--sp-muted)]">{row.eventDate || row.weekday || '—'}</span>
              </li>
            ))}
            {nsDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
              >
                <span className="text-sm text-[var(--sp-ink)]">{doc.title}</span>
                <span className="text-sm text-[var(--sp-muted)]">{doc.publishedDate || 'doc'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10">
        <h2 className="sp-section tracking-[0.12em] mb-3">This month</h2>
        {planner.length > 0 ? (
          <MonthlyPlanner subjects={planner} month={monthData.month} year={monthData.year} />
        ) : (
          <EmptyState
            title="Monthly planner coming soon"
            description="Check back once the newsletter arrives."
          />
        )}
      </div>
    </div>
  );
}

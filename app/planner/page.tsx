'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import PlannerCalendar from '@/components/PlannerCalendar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  getMonthData,
  getMonthlyPlanner,
  getAvailableMonths,
  getCurrentMonthId,
  getImportantDates,
  getToday,
  MonthInfo,
  ImportantDate,
  PlannerSubject,
} from '@/lib/data';
import { useCanonicalScheduleQuery } from '@/lib/queries/schedule';

function defaultSelectedDate(year: number, monthName: string, dates: ImportantDate[]) {
  const today = getToday();
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  if (today.startsWith(prefix)) return today;

  const firstWithEvent = dates.find((d) => d.date.startsWith(prefix));
  if (firstWithEvent) return firstWithEvent.date;

  return `${prefix}-01`;
}

export default function PlannerPage() {
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [monthData, setMonthData] = useState<{
    month: string;
    year: number;
    class: string;
  } | null>(null);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [planner, setPlanner] = useState<PlannerSubject[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scheduleQuery = useCanonicalScheduleQuery();

  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    setSelectedMonthId(getCurrentMonthId());
  }, []);

  useEffect(() => {
    if (!selectedMonthId) return;
    const data = getMonthData(selectedMonthId);
    const nextMonth = { month: data.month, year: data.year, class: data.class };
    const dates = getImportantDates(selectedMonthId);
    setMonthData(nextMonth);
    setImportantDates(dates);
    setPlanner(getMonthlyPlanner(selectedMonthId));
    setSelectedDate(defaultSelectedDate(nextMonth.year, nextMonth.month, dates));
  }, [selectedMonthId]);

  const monthIndex = useMemo(
    () => availableMonths.findIndex((m) => m.id === selectedMonthId),
    [availableMonths, selectedMonthId],
  );

  const nsEvents = scheduleQuery.data?.events ?? [];
  const nsDocs = (scheduleQuery.data?.documents ?? []).filter(
    (d) => d.scheduleDocument || /timetable|newsletter/i.test(d.title),
  );

  if (!monthData) {
    return (
      <div className="sp-page">
        <LoadingState rows={4} />
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PlannerCalendar
        month={monthData.month}
        year={monthData.year}
        dates={importantDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        canGoPrev={monthIndex > 0}
        canGoNext={monthIndex >= 0 && monthIndex < availableMonths.length - 1}
        onPrevMonth={() => {
          if (monthIndex > 0) setSelectedMonthId(availableMonths[monthIndex - 1].id);
        }}
        onNextMonth={() => {
          if (monthIndex >= 0 && monthIndex < availableMonths.length - 1) {
            setSelectedMonthId(availableMonths[monthIndex + 1].id);
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
          Same canonical source as Joy of Learning Dates (Calendar API + schedule documents). Sync:{' '}
          {scheduleQuery.data?.freshness.lastStatus || 'unknown'}
        </p>
        {nsEvents.length === 0 && nsDocs.length === 0 ? (
          <EmptyState
            title="No live NeverSkip schedule events"
            description="When Calendar or a timetable document syncs from NeverSkip, it appears here and on Timetable / Joy of Learning."
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

'use client';

import { useEffect, useMemo, useState } from 'react';
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
    [availableMonths, selectedMonthId]
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

      <div className="mt-10">
        <h2 className="sp-section tracking-[0.12em] mb-3">This month</h2>
        {planner.length > 0 ? (
          <MonthlyPlanner
            subjects={planner}
            month={monthData.month}
            year={monthData.year}
          />
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

'use client';

import { useEffect, useState } from 'react';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import MonthSelector from '@/components/MonthSelector';
import ImportantDates from '@/components/ImportantDates';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  getMonthData,
  getMonthlyPlanner,
  getAvailableMonths,
  getCurrentMonthId,
  getImportantDates,
  MonthInfo,
  ImportantDate,
  PlannerSubject,
} from '@/lib/data';

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

  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    setSelectedMonthId(getCurrentMonthId());
  }, []);

  useEffect(() => {
    if (!selectedMonthId) return;
    const data = getMonthData(selectedMonthId);
    setMonthData({ month: data.month, year: data.year, class: data.class });
    setImportantDates(getImportantDates(selectedMonthId));
    setPlanner(getMonthlyPlanner(selectedMonthId));
  }, [selectedMonthId]);

  if (!monthData) {
    return (
      <div className="sp-page">
        <LoadingState rows={4} />
      </div>
    );
  }

  const upcomingDates = importantDates
    .filter((d) => d.date >= new Date().toISOString().split('T')[0])
    .slice(0, 6);

  return (
    <div className="sp-page">
      <PageHeader
        title="Planner"
        subtitle={`${monthData.month} ${monthData.year} · ${monthData.class}`}
        actions={
          <MonthSelector
            months={availableMonths}
            selectedMonthId={selectedMonthId}
            onMonthChange={setSelectedMonthId}
          />
        }
      />

      {planner.length > 0 ? (
        <MonthlyPlanner
          subjects={planner}
          month={monthData.month}
          year={monthData.year}
          className="mb-8"
        />
      ) : (
        <EmptyState
          title="Monthly planner coming soon"
          description="Check back once the newsletter arrives."
        />
      )}

      {upcomingDates.length > 0 ? (
        <div className="mt-8">
          <ImportantDates dates={upcomingDates} title="Important dates" />
        </div>
      ) : null}
    </div>
  );
}

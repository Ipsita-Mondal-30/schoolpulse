'use client';

import { useQuery } from '@tanstack/react-query';
import { loadCanonicalScheduleForUi, loadPlannerMonth } from '@/app/actions';
import type { CanonicalSchedule } from '@/lib/schedule/canonical';

export const scheduleQueryKey = ['canonical-schedule'] as const;

export async function fetchCanonicalSchedule(): Promise<CanonicalSchedule> {
  return loadCanonicalScheduleForUi();
}

export function useCanonicalScheduleQuery() {
  return useQuery({
    queryKey: scheduleQueryKey,
    queryFn: fetchCanonicalSchedule,
  });
}

export function usePlannerMonthQuery(monthKey: string | null) {
  return useQuery({
    queryKey: ['planner-month', monthKey ?? 'current'] as const,
    queryFn: () => loadPlannerMonth(monthKey ?? undefined),
    placeholderData: (prev) => prev,
  });
}

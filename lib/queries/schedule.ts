'use client';

import { useQuery } from '@tanstack/react-query';
import { loadCanonicalScheduleForUi } from '@/app/actions';
import type { CanonicalSchedule } from '@/lib/schedule/canonical';

export const scheduleQueryKey = ['canonical-schedule'] as const;

export async function fetchCanonicalSchedule(): Promise<CanonicalSchedule> {
  return loadCanonicalScheduleForUi();
}

export function useCanonicalScheduleQuery() {
  return useQuery({
    queryKey: scheduleQueryKey,
    queryFn: fetchCanonicalSchedule,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

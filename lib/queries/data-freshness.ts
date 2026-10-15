'use client';

import { useQuery } from '@tanstack/react-query';
import { loadDataFreshness } from '@/app/actions';

export const dataFreshnessQueryKey = ['data-freshness'] as const;

export function useDataFreshnessQuery() {
  return useQuery({
    queryKey: dataFreshnessQueryKey,
    queryFn: () => loadDataFreshness(),
    staleTime: 60_000,
  });
}

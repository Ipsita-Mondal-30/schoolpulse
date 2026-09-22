'use client';

import { useQuery } from '@tanstack/react-query';
import { loadJolForUi, type UiJolItem } from '@/app/actions';

export const jolQueryKey = ['jol'] as const;

export async function fetchJolForUi(): Promise<UiJolItem[]> {
  return loadJolForUi();
}

export function useJolQuery() {
  return useQuery({
    queryKey: jolQueryKey,
    queryFn: fetchJolForUi,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

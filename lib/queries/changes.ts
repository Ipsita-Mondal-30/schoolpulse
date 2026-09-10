'use client';

import { useQuery } from '@tanstack/react-query';
import { loadRecentChanges, type UiChangeItem } from '@/app/actions';

export const changesQueryKey = ['changes'] as const;

export type ChangesQueryData = UiChangeItem[];

export async function fetchRecentChanges(): Promise<ChangesQueryData> {
  return loadRecentChanges({ days: 30 });
}

export function useChangesQuery() {
  return useQuery({
    queryKey: changesQueryKey,
    queryFn: fetchRecentChanges,
  });
}

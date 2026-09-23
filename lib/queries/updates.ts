'use client';

import { useQuery } from '@tanstack/react-query';
import { loadRecentUpdates } from '@/app/actions';
import type { UpdateFeedItem } from '@/lib/updates-feed';

export const updatesFeedQueryKey = ['updates-feed'] as const;

export type UpdatesFeedQueryData = UpdateFeedItem[];

export async function fetchRecentUpdates(): Promise<UpdatesFeedQueryData> {
  return loadRecentUpdates({ days: 7 });
}

export function useUpdatesFeedQuery() {
  return useQuery({
    queryKey: updatesFeedQueryKey,
    queryFn: fetchRecentUpdates,
  });
}

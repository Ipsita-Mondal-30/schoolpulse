'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadSchoolPulseDataVersion } from '@/app/actions';
import { homeworkQueryKey } from '@/lib/queries/homework';
import { noticesQueryKey } from '@/lib/queries/notices';
import { updatesFeedQueryKey } from '@/lib/queries/updates';
import { jolQueryKey } from '@/lib/queries/jol';
import { scheduleQueryKey } from '@/lib/queries/schedule';
import { thisWeekQueryKey } from '@/lib/queries/this-week';
import { dailyBriefQueryKey } from '@/lib/queries/daily-brief';

export const dataVersionQueryKey = ['schoolpulse', 'data-version'] as const;

/**
 * Polls server data-version (bumped on NeverSkip sync).
 * When the version changes, invalidate school-content query caches so parents
 * see fresh Neon data without waiting for the 5-minute staleTime.
 */
export function useSchoolPulseDataVersionSync() {
  const qc = useQueryClient();
  const lastVersion = useRef<string | null>(null);

  const query = useQuery({
    queryKey: dataVersionQueryKey,
    queryFn: loadSchoolPulseDataVersion,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const version = query.data?.version;
    if (!version) return;
    if (lastVersion.current === null) {
      lastVersion.current = version;
      return;
    }
    if (lastVersion.current === version) return;
    lastVersion.current = version;
    void qc.invalidateQueries({ queryKey: homeworkQueryKey });
    void qc.invalidateQueries({ queryKey: noticesQueryKey });
    void qc.invalidateQueries({ queryKey: updatesFeedQueryKey });
    void qc.invalidateQueries({ queryKey: jolQueryKey });
    void qc.invalidateQueries({ queryKey: scheduleQueryKey });
    void qc.invalidateQueries({ queryKey: thisWeekQueryKey });
    void qc.invalidateQueries({ queryKey: dailyBriefQueryKey });
    void qc.invalidateQueries({ queryKey: ['this-week'] });
  }, [query.data?.version, qc]);

  return query;
}

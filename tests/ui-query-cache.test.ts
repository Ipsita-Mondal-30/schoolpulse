import { describe, expect, it, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  UI_QUERY_GC_TIME_MS,
  UI_QUERY_STALE_TIME_MS,
  makeQueryClient,
} from '@/components/providers/query-provider';
import { homeworkQueryKey } from '@/lib/queries/homework';
import { noticesQueryKey } from '@/lib/queries/notices';
import { filterHomeworkBySection, type UiHomeworkItem } from '@/lib/ui-merge';

describe('TanStack Query UI cache', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeQueryClient();
  });

  it('uses 5-minute staleTime and 30-minute gcTime defaults', () => {
    expect(UI_QUERY_STALE_TIME_MS).toBe(5 * 60 * 1000);
    expect(UI_QUERY_GC_TIME_MS).toBe(30 * 60 * 1000);
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(UI_QUERY_STALE_TIME_MS);
    expect(defaults?.gcTime).toBe(UI_QUERY_GC_TIME_MS);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it('fetches homework on first visit and reuses cache within staleTime', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      return { items: [{ id: 'hw-1' }], fromSheet: true };
    });

    const first = await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: fetcher,
    });
    const second = await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: fetcher,
    });

    expect(first).toEqual({ items: [{ id: 'hw-1' }], fromSheet: true });
    expect(second).toEqual(first);
    expect(calls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps homework and notices caches independent', async () => {
    await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: async () => ({ items: [{ id: 'hw' }], fromSheet: false }),
    });
    await client.fetchQuery({
      queryKey: noticesQueryKey,
      queryFn: async () => [{ id: 'n1' }],
    });

    expect(client.getQueryData(homeworkQueryKey)).toEqual({
      items: [{ id: 'hw' }],
      fromSheet: false,
    });
    expect(client.getQueryData(noticesQueryKey)).toEqual([{ id: 'n1' }]);
  });

  it('refetches homework after staleTime so NeverSkip updates can appear', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { items: [{ id: String(calls) }], fromSheet: false };
    };

    await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: fetcher,
    });

    // Mark stale by rewriting dataUpdatedAt into the past past staleTime.
    const state = client.getQueryState(homeworkQueryKey);
    expect(state).toBeTruthy();
    client.setQueryData(homeworkQueryKey, state!.data, {
      updatedAt: Date.now() - UI_QUERY_STALE_TIME_MS - 1,
    });

    const next = await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: fetcher,
    });

    expect(calls).toBe(2);
    expect(next.items[0]).toEqual({ id: '2' });
  });

  it('surfaces query errors without overwriting sibling cache', async () => {
    await client.fetchQuery({
      queryKey: noticesQueryKey,
      queryFn: async () => [{ id: 'ok' }],
    });

    await expect(
      client.fetchQuery({
        queryKey: homeworkQueryKey,
        queryFn: async () => {
          throw new Error('boom');
        },
        retry: false,
      }),
    ).rejects.toThrow('boom');

    expect(client.getQueryData(noticesQueryKey)).toEqual([{ id: 'ok' }]);
    expect(client.getQueryState(homeworkQueryKey)?.status).toBe('error');
  });

  it('preserves section filtering on cached homework payloads', async () => {
    const items: UiHomeworkItem[] = [
      {
        id: '1',
        title: 'Math',
        subject: 'Mathematics',
        description: 'Practice',
        sentDate: '2026-09-01',
        sections: ['I-A', 'I-B'],
      },
      {
        id: '2',
        title: 'English',
        subject: 'English',
        description: 'Read',
        sentDate: '2026-09-01',
        sections: ['I-C'],
      },
    ];

    await client.fetchQuery({
      queryKey: homeworkQueryKey,
      queryFn: async () => ({ items, fromSheet: false }),
    });

    const cached = client.getQueryData<{ items: UiHomeworkItem[] }>(homeworkQueryKey)!;
    expect(filterHomeworkBySection(cached.items, 'I-A')).toHaveLength(1);
    expect(filterHomeworkBySection(cached.items, 'I-C')[0].id).toBe('2');
  });
});

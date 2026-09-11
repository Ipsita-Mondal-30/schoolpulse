'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatRelativeTimeIndia,
  presentChangeLines,
  type FieldChange,
} from '@/lib/neverskip/changes';
import { useChangesQuery } from '@/lib/queries/changes';
import type { UiChangeItem } from '@/app/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SectionHeader } from '@/components/ui/SectionHeader';

const LAST_SEEN_KEY = 'schoolpulse_changes_last_seen';

type Filter = 'all' | 'homework' | 'notice';

function toFieldChanges(item: UiChangeItem): FieldChange[] {
  return item.changedFields.map((c) => ({
    field: c.field,
    label: c.label,
    previous: c.previous,
    current: c.current,
    reliable: c.reliable,
  }));
}

function dayKey(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function dayHeading(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'Today';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ChangesPage() {
  const { data, isPending, isError, refetch } = useChangesQuery();
  const [filter, setFilter] = useState<Filter>('all');
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [visitMarked, setVisitMarked] = useState(false);
  const [todayYmd, setTodayYmd] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTodayYmd(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
    const prev = localStorage.getItem(LAST_SEEN_KEY);
    setLastSeen(prev);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setVisitMarked(true);
  }, []);

  const items = data ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const sinceVisitCount = useMemo(() => {
    if (!lastSeen) return items.length;
    const t = new Date(lastSeen).getTime();
    if (Number.isNaN(t)) return items.length;
    return items.filter((i) => new Date(i.detectedAt).getTime() > t).length;
  }, [items, lastSeen]);

  const grouped = useMemo(() => {
    const map = new Map<string, UiChangeItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.detectedAt);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  if (isPending) {
    return (
      <div className="sp-page">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page">
        <p className="text-sm font-semibold">Couldn&apos;t load recent changes.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 px-4 py-2.5 bg-[var(--sp-primary)] text-white text-sm font-semibold rounded-xl sp-focus"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PageHeader
        title="Something Changed"
        subtitle="Updates from your child's school"
      />

      <div className="mb-5">
        <FilterTabs
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'homework', label: 'Homework' },
            { id: 'notice', label: 'Notices' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {visitMarked ? (
        <p className="sp-meta mb-5">
          {sinceVisitCount === 0
            ? 'No new updates since your last visit'
            : `${sinceVisitCount} update${sinceVisitCount === 1 ? '' : 's'} since your last visit`}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="No homework or notice changes recently."
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([ymd, dayItems]) => (
            <section key={ymd}>
              <SectionHeader label={dayHeading(ymd, todayYmd)} />
              <div className="sp-card divide-y divide-[var(--sp-border)]">
                {dayItems.map((item) => {
                  const lines = presentChangeLines(item.type, toFieldChanges(item));
                  const isHw = item.type === 'homework';
                  return (
                    <article key={item.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                            {isHw ? 'Homework updated' : 'Notice updated'}
                          </p>
                          {isHw && item.subject ? (
                            <p className="text-xs font-semibold text-[var(--sp-muted)] mt-0.5">
                              {item.subject}
                            </p>
                          ) : null}
                          <h3 className="text-sm font-semibold text-[var(--sp-ink)] mt-0.5 leading-snug">
                            {item.title}
                          </h3>
                          <div className="mt-2 space-y-1.5">
                            {lines.map((line, idx) => (
                              <div key={`${line.heading}-${idx}`}>
                                <p className="text-sm text-[var(--sp-muted)]">{line.heading}</p>
                                {line.showDiff &&
                                line.previous != null &&
                                line.current != null ? (
                                  <p className="text-sm text-[var(--sp-ink)]/80 mt-0.5 break-words">
                                    <span className="line-through text-[var(--sp-subtle)]">
                                      {line.previous}
                                    </span>
                                    <span className="mx-1.5 text-[var(--sp-subtle)]">→</span>
                                    <span className="font-medium">{line.current}</span>
                                  </p>
                                ) : line.current && !line.showDiff ? (
                                  <p className="text-sm text-[var(--sp-muted)] mt-0.5">
                                    {line.current}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <Link
                            href={isHw ? '/homework' : '/notices'}
                            className="inline-block mt-2 text-xs font-semibold text-[var(--sp-primary)] hover:underline"
                          >
                            {isHw ? 'View homework' : 'View notice'}
                          </Link>
                        </div>
                        <time className="sp-meta shrink-0" dateTime={item.detectedAt}>
                          {formatRelativeTimeIndia(item.detectedAt)}
                        </time>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

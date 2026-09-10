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

function ChangeCard({ item }: { item: UiChangeItem }) {
  const lines = presentChangeLines(item.type, toFieldChanges(item));
  const when = formatRelativeTimeIndia(item.detectedAt);
  const isHw = item.type === 'homework';

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isHw
              ? 'bg-sky-50 text-sky-700 border border-sky-100'
              : 'bg-violet-50 text-violet-700 border border-violet-100'
          }`}
        >
          {isHw ? 'Homework updated' : 'Notice updated'}
        </span>
        <time
          dateTime={item.detectedAt}
          className="text-xs text-gray-400 font-medium shrink-0"
        >
          {when}
        </time>
      </div>

      {isHw && item.subject ? (
        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 mb-0.5">
          {item.subject}
        </p>
      ) : null}
      <h3 className="text-sm font-bold text-gray-900 leading-snug break-words">
        {item.title}
      </h3>

      <div className="mt-3 space-y-2">
        {lines.map((line, idx) => (
          <div key={`${line.heading}-${idx}`}>
            <p className="text-sm font-semibold text-gray-700">{line.heading}</p>
            {line.showDiff && line.previous != null && line.current != null ? (
              <p className="text-sm text-gray-500 mt-0.5 break-words">
                <span className="line-through decoration-gray-300">{line.previous}</span>
                <span className="mx-1.5 text-gray-300">→</span>
                <span className="font-medium text-gray-800">{line.current}</span>
              </p>
            ) : line.current && !line.showDiff ? (
              <p className="text-sm text-gray-500 mt-0.5 break-words">{line.current}</p>
            ) : line.previous && !line.showDiff ? (
              <p className="text-sm text-gray-500 mt-0.5 break-words">{line.previous}</p>
            ) : null}
          </div>
        ))}
      </div>

      <Link
        href={isHw ? '/homework' : '/notices'}
        className="inline-block mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
      >
        {isHw ? 'View homework →' : 'View notice →'}
      </Link>
    </article>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 animate-pulse space-y-3">
      <div className="h-10 bg-gray-200 rounded-xl w-1/2" />
      <div className="h-16 bg-gray-100 rounded-2xl" />
      <div className="h-28 bg-gray-100 rounded-2xl" />
      <div className="h-28 bg-gray-100 rounded-2xl" />
    </div>
  );
}

export default function ChangesPage() {
  const { data, isPending, isError, refetch } = useChangesQuery();
  const [filter, setFilter] = useState<Filter>('all');
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [visitMarked, setVisitMarked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = localStorage.getItem(LAST_SEEN_KEY);
    setLastSeen(prev);
    // Mark visit after reading previous watermark
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

  if (isPending) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">
            Couldn&apos;t load recent changes.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 px-4 py-2.5 min-h-11 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'homework', label: 'Homework' },
    { id: 'notice', label: 'Notices' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Something Changed
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Updates from your child&apos;s school
        </p>
      </header>

      <div
        className="flex gap-2 mb-4 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Change filters"
      >
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 py-2 min-h-10 rounded-full text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                active
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visitMarked && (
        <div className="rounded-xl border border-gray-100 bg-orange-50/50 px-3.5 py-3 mb-4">
          <p className="text-sm font-semibold text-gray-800">
            {sinceVisitCount === 0
              ? 'No new updates since your last visit'
              : `${sinceVisitCount} ${
                  sinceVisitCount === 1 ? 'update' : 'updates'
                } since your last visit`}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-base font-bold text-gray-800">
            You&apos;re all caught up
          </p>
          <p className="text-sm text-gray-500 mt-1">
            No homework or notice changes recently.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ChangeCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

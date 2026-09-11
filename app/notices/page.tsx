'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { filterNoticesByClass, type UiNoticeItem } from '@/lib/ui-merge';
import { useNoticesQuery } from '@/lib/queries/notices';
import AcknowledgeButton from '@/components/AcknowledgeButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';

function formatDateLabel(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Undated';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
  );
}

export default function NoticesPage() {
  const { data, isPending, isError, error, refetch } = useNoticesQuery();
  const notices = data ?? [];
  const [activeClass, setActiveClass] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    if (isError) console.error('Failed to fetch notices', error);
  }, [isError, error]);

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved) setActiveClass(saved);
    else setActiveClass(DEFAULT_SECTION);
  }, []);

  const allClasses = useMemo(
    () =>
      Array.from(new Set(notices.flatMap((n) => n.classes))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [notices],
  );

  const filtered = useMemo(() => {
    if (activeClass === 'All') return notices;
    return filterNoticesByClass(notices, activeClass);
  }, [notices, activeClass]);

  return (
    <div className="sp-page">
      <PageHeader
        title="Notices"
        subtitle="Updates from the parent portal"
      />

      <div className="mb-5 overflow-x-auto scrollbar-none -mx-1 px-1">
        <div className="flex gap-1.5 w-max">
          <button
            type="button"
            onClick={() => setActiveClass('All')}
            className={`min-h-9 px-3 rounded-lg text-xs font-semibold border sp-focus ${
              activeClass === 'All'
                ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                : 'bg-white text-[var(--sp-muted)] border-[var(--sp-border)]'
            }`}
          >
            All
          </button>
          {allClasses.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveClass(c)}
              className={`min-h-9 px-3 rounded-lg text-xs font-semibold border sp-focus ${
                activeClass === c
                  ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                  : 'bg-white text-[var(--sp-muted)] border-[var(--sp-border)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <LoadingState rows={5} />
      ) : isError ? (
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load notices.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold sp-focus"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No notices" description="Nothing for this class yet." />
      ) : (
        <ul className="sp-card">
          {filtered.map((notice: UiNoticeItem) => {
            const open = expandedId === notice.id;
            const isNew =
              today !== '' &&
              daysBetween(notice.date, today) >= 0 &&
              daysBetween(notice.date, today) <= 2;
            return (
              <li key={notice.id} className="border-b border-[var(--sp-border)] last:border-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : notice.id)}
                  className="w-full text-left px-4 py-3.5 hover:bg-[var(--sp-primary-soft)]/40 transition-colors sp-focus"
                  aria-expanded={open}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[var(--sp-ink)] leading-snug">
                          {notice.summary || 'School notice'}
                        </p>
                        {isNew ? <StatusBadge tone="primary">New</StatusBadge> : null}
                      </div>
                      {!open && notice.message ? (
                        <p className="text-sm text-[var(--sp-muted)] mt-0.5 line-clamp-2">
                          {notice.message}
                        </p>
                      ) : null}
                      <p className="sp-meta mt-1.5">{formatDateLabel(notice.date)}</p>
                    </div>
                  </div>
                </button>
                {open ? (
                  <div className="px-4 pb-4 space-y-3 bg-[var(--sp-bg)]/50">
                    <p className="text-sm text-[var(--sp-ink)]/90 leading-relaxed whitespace-pre-line">
                      {notice.message}
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <AcknowledgeButton kind="notice" itemId={notice.id} />
                    </div>
                    <Link
                      href="/class-diary"
                      className="inline-block text-xs font-semibold text-[var(--sp-primary)] hover:underline"
                    >
                      Open library
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

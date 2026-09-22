'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  filterNoticesByClass,
  sortNoticesNewestFirst,
  toSortableDate,
  type UiNoticeItem,
} from '@/lib/ui-merge';
import { CLASS1_SECTIONS, isClass1Section } from '@/lib/class-sections';
import { useNoticesQuery } from '@/lib/queries/notices';
import { useMyAcknowledgementsQuery } from '@/lib/queries/acknowledgements';
import AcknowledgeButton from '@/components/AcknowledgeButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { markNoticeRead } from '@/lib/updates-unread';
import libraryData from '@/data/content-library.json';
import { resolveNoticeLibraryLink } from '@/lib/notice-library-link';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'All';
const ALL_SECTIONS = ['All', ...CLASS1_SECTIONS] as const;
const LIBRARY_RESOURCES = (libraryData.resources as { id: string; title: string; date: string }[]).map(
  (r) => ({ id: r.id, title: r.title, date: r.date }),
);

function formatDateLabel(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Undated';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function sectionLabel(sec: string): string {
  if (sec === 'All') return 'All sections';
  const letter = sec.includes('-') ? sec.split('-')[1] : sec;
  return `Class 1 · Section ${letter}`;
}

export default function NoticesPage() {
  const { data: noticesData, isPending, isError, refetch } = useNoticesQuery();
  const { data: acks } = useMyAcknowledgementsQuery();
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved === 'All' || (saved && isClass1Section(saved))) setSection(saved);
    const item = new URLSearchParams(window.location.search).get('item');
    if (item) setExpandedId(item);
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    const el = document.getElementById(`notice-${expandedId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [expandedId, isPending]);

  const notices = noticesData ?? [];
  const ackedNotices = new Set(Object.keys(acks?.notices ?? {}));
  const filteredNotices = useMemo(
    () => sortNoticesNewestFirst(filterNoticesByClass(notices, section)),
    [notices, section],
  );

  const latestNoticeDate = useMemo(() => {
    let max = '';
    for (const n of notices) {
      const d = toSortableDate(n.date);
      if (d && d > max) max = d;
    }
    return max;
  }, [notices]);

  const latestSectionNoticeDate = useMemo(() => {
    let max = '';
    for (const n of filteredNotices) {
      const d = toSortableDate(n.date);
      if (d && d > max) max = d;
    }
    return max;
  }, [filteredNotices]);

  const sectionHasOlderNotices =
    Boolean(latestNoticeDate) &&
    (latestSectionNoticeDate === '' || latestSectionNoticeDate < latestNoticeDate);

  return (
    <div className="sp-page">
      <PageHeader
        title="Notices"
        subtitle="From the school"
        actions={
          <label className="block">
            <span className="sr-only">Section</span>
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                localStorage.setItem(PINNED_SECTION_KEY, e.target.value);
              }}
              className="min-h-10 rounded-xl border border-[var(--sp-border)] bg-white px-3 text-sm font-semibold text-[var(--sp-ink)] shadow-sm sp-focus"
            >
              {ALL_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sectionLabel(sec)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {!isPending && !isError && sectionHasOlderNotices ? (
        <p className="mb-5 text-sm text-[var(--sp-muted)]">
          {latestSectionNoticeDate
            ? `No newer notices for ${sectionLabel(section)} since ${formatDateLabel(latestSectionNoticeDate)}. Latest school notice is ${formatDateLabel(latestNoticeDate)}.`
            : `No notices for ${sectionLabel(section)}. Latest school notice is ${formatDateLabel(latestNoticeDate)}.`}
        </p>
      ) : null}

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
      ) : filteredNotices.length === 0 ? (
        <EmptyState title="No notices" description="Nothing for this section yet." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
          {filteredNotices.map((notice: UiNoticeItem) => {
            const open = expandedId === notice.id;
            const libraryLink = open
              ? resolveNoticeLibraryLink(notice, LIBRARY_RESOURCES)
              : null;
            return (
              <li
                key={notice.id}
                id={`notice-${notice.id}`}
                className="border-b border-[var(--sp-border)] last:border-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(open ? null : notice.id);
                    markNoticeRead(notice.id);
                  }}
                  className="w-full px-4 py-3.5 text-left hover:bg-[var(--sp-primary-soft)]/40 sp-focus"
                  aria-expanded={open}
                >
                  <p className="text-sm font-semibold leading-snug text-[var(--sp-ink)]">
                    {notice.summary || 'School notice'}
                  </p>
                  {!open && notice.message ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--sp-muted)]">
                      {notice.message}
                    </p>
                  ) : null}
                  <p className="sp-meta mt-1.5">
                    {formatDateLabel(notice.date)}
                    {notice.time ? ` · ${notice.time}` : ''}
                    {ackedNotices.has(notice.id) ? ' · Seen' : ''}
                  </p>
                </button>
                {open ? (
                  <div className="space-y-3 bg-[var(--sp-bg)]/50 px-4 pb-4">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sp-ink)]/90">
                      {notice.message}
                    </p>
                    {libraryLink ? (
                      <Link
                        href={libraryLink.href}
                        className="inline-flex items-center text-sm font-medium text-[var(--sp-primary)] hover:underline sp-focus"
                      >
                        View in Content Library →
                      </Link>
                    ) : null}
                    <div onClick={(e) => e.stopPropagation()}>
                      <AcknowledgeButton kind="notice" itemId={notice.id} />
                    </div>
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

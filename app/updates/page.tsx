'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatRelativeTimeIndia,
  presentChangeLines,
  type FieldChange,
} from '@/lib/neverskip/changes';
import { filterNoticesByClass, toSortableDate, type UiNoticeItem } from '@/lib/ui-merge';
import { CLASS1_SECTIONS, isClass1Section } from '@/lib/class-sections';
import { useChangesQuery } from '@/lib/queries/changes';
import { useNoticesQuery } from '@/lib/queries/notices';
import { useMyAcknowledgementsQuery } from '@/lib/queries/acknowledgements';
import type { UiChangeItem } from '@/app/actions';
import AcknowledgeButton from '@/components/AcknowledgeButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  isNewerThan,
  markNoticeRead,
  noticePublishedIso,
  readLastSeenIso,
  readNoticeIds,
  writeLastSeenNow,
} from '@/lib/updates-unread';
import libraryData from '@/data/content-library.json';
import { resolveNoticeLibraryLink } from '@/lib/notice-library-link';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';
const ALL_SECTIONS = [...CLASS1_SECTIONS];
const LIBRARY_RESOURCES = (libraryData.resources as { id: string; title: string; date: string }[]).map(
  (r) => ({ id: r.id, title: r.title, date: r.date }),
);

function toFieldChanges(item: UiChangeItem): FieldChange[] {
  return item.changedFields.map((c) => ({
    field: c.field,
    label: c.label,
    previous: c.previous,
    current: c.current,
    reliable: c.reliable,
  }));
}

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
  const letter = sec.includes('-') ? sec.split('-')[1] : sec;
  return `Class 1 · Section ${letter}`;
}

export default function UpdatesPage() {
  const { data: changesData, isPending: changesPending, isError: changesError, refetch: refetchChanges } =
    useChangesQuery();
  const { data: noticesData, isPending: noticesPending, isError: noticesError, refetch: refetchNotices } =
    useNoticesQuery();
  const { data: acks } = useMyAcknowledgementsQuery();

  const [section, setSection] = useState(DEFAULT_SECTION);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && isClass1Section(saved)) setSection(saved);
    setLastSeen(readLastSeenIso());
    setReadIds(readNoticeIds());
    writeLastSeenNow();
  }, []);

  const notices = noticesData ?? [];
  const changes = changesData ?? [];
  const ackedNotices = new Set(Object.keys(acks?.notices ?? {}));

  const filteredNotices = useMemo(
    () => filterNoticesByClass(notices, section),
    [notices, section],
  );

  const unreadChanges = useMemo(
    () => changes.filter((item) => isNewerThan(item.detectedAt, lastSeen)),
    [changes, lastSeen],
  );

  const newNotices = useMemo(
    () =>
      filteredNotices.filter((n) => {
        if (ackedNotices.has(n.id) || readIds.includes(n.id)) return false;
        const published = noticePublishedIso(n.date, n.time);
        return published ? isNewerThan(published, lastSeen) : false;
      }),
    [filteredNotices, ackedNotices, readIds, lastSeen],
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

  const openNotice = (id: string) => {
    setExpandedId(id);
    setReadIds(markNoticeRead(id));
    const el = document.getElementById(`notice-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isPending = changesPending || noticesPending;
  const isError = changesError || noticesError;

  return (
    <div className="sp-page">
      <PageHeader
        title="Updates"
        subtitle="What changed, and the full notice history"
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
          <p className="text-sm font-semibold">Couldn&apos;t load updates.</p>
          <button
            type="button"
            onClick={() => {
              void refetchChanges();
              void refetchNotices();
            }}
            className="mt-3 px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold sp-focus"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeader label="New / changed" />
            {unreadChanges.length === 0 && newNotices.length === 0 ? (
              <EmptyState
                title="You're all caught up"
                description="Nothing new since you last checked."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
                {unreadChanges.map((item, index) => {
                  const lines = presentChangeLines(item.type, toFieldChanges(item));
                  const isHw = item.type === 'homework';
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3.5 ${index > 0 ? 'border-t border-[var(--sp-border)]' : ''}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                        {isHw ? 'Homework updated' : 'Notice updated'}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--sp-ink)]">
                        {item.subject ? `${item.subject} · ` : ''}
                        {item.title}
                      </p>
                      {lines[0] ? (
                        <p className="mt-1 text-sm text-[var(--sp-muted)]">{lines[0].heading}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        {isHw ? (
                          <Link
                            href="/homework"
                            className="text-xs font-semibold text-[var(--sp-primary)] hover:underline"
                          >
                            Open homework
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openNotice(`neverskip:${item.sourceId}`)}
                            className="text-xs font-semibold text-[var(--sp-primary)] hover:underline"
                          >
                            Open notice
                          </button>
                        )}
                        <time className="sp-meta" dateTime={item.detectedAt}>
                          {formatRelativeTimeIndia(item.detectedAt)}
                        </time>
                      </div>
                    </div>
                  );
                })}
                {newNotices.map((notice) => (
                  <button
                    key={`new-${notice.id}`}
                    type="button"
                    onClick={() => openNotice(notice.id)}
                    className="flex w-full items-start justify-between gap-3 border-t border-[var(--sp-border)] px-4 py-3.5 text-left hover:bg-[var(--sp-bg)] sp-focus"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                        New notice
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--sp-ink)]">
                        {notice.summary || 'School notice'}
                      </p>
                    </div>
                    <StatusBadge tone="primary">New</StatusBadge>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader label="Notices" />
            {filteredNotices.length === 0 ? (
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
                          setReadIds(markNoticeRead(notice.id));
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
          </section>
        </div>
      )}
    </div>
  );
}

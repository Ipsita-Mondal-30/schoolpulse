'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  presentChangeLines,
  type FieldChange,
} from '@/lib/neverskip/changes';
import { CLASS1_SECTIONS, isClass1Section } from '@/lib/class-sections';
import { useUpdatesFeedQuery } from '@/lib/queries/updates';
import {
  countUnreadUpdates,
  filterUpdatesBySection,
  formatUpdateOccurredLabel,
  formatUpdateSourceDateLabel,
  type UpdateFeedItem,
} from '@/lib/updates-feed';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isNewerThan, readLastSeenIso, writeLastSeenNow } from '@/lib/updates-unread';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';
const ALL_SECTIONS = [...CLASS1_SECTIONS];

function toFieldChanges(item: UpdateFeedItem): FieldChange[] {
  return item.changedFields.map((c) => ({
    field: c.field,
    label: c.label,
    previous: c.previous,
    current: c.current,
    reliable: c.reliable,
  }));
}

function sectionLabel(sec: string): string {
  const letter = sec.includes('-') ? sec.split('-')[1] : sec;
  return `Class 1 · Section ${letter}`;
}

export default function UpdatesPage() {
  const { data, isPending, isError, refetch } = useUpdatesFeedQuery();
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && isClass1Section(saved)) setSection(saved);
    setLastSeen(readLastSeenIso());
    writeLastSeenNow();
  }, []);

  const feed = useMemo(
    () => filterUpdatesBySection(data ?? [], section),
    [data, section],
  );
  const unreadCount = countUnreadUpdates(feed, lastSeen);

  return (
    <div className="sp-page">
      <PageHeader
        title="Updates"
        subtitle="New and changed homework and notices"
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

      {isPending ? (
        <LoadingState rows={5} />
      ) : isError ? (
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load updates.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 px-4 py-2 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold sp-focus"
          >
            Retry
          </button>
        </div>
      ) : feed.length === 0 ? (
        <EmptyState
          title="Nothing new since last visit"
          description="When NeverSkip adds or changes homework or a notice, it will show up here."
        />
      ) : (
        <div className="space-y-4">
          {unreadCount > 0 ? (
            <p className="text-sm text-[var(--sp-muted)]">
              {unreadCount} new update{unreadCount === 1 ? '' : 's'} since last visit
            </p>
          ) : (
            <p className="text-sm text-[var(--sp-muted)]">Nothing new since last visit. Recent imports are listed below.</p>
          )}
          <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
            {feed.map((item, index) => {
              const unread = isNewerThan(item.occurredAt, lastSeen);
              const isHw = item.type === 'homework';
              const lines =
                item.kind === 'changed' ? presentChangeLines(item.type, toFieldChanges(item)) : [];
              const sourceDate = formatUpdateSourceDateLabel(item.type, item.sourceDate);
              return (
                <article
                  key={item.id}
                  className={`px-4 py-3.5 ${index > 0 ? 'border-t border-[var(--sp-border)]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                      {item.kind === 'new'
                        ? isHw
                          ? 'New homework'
                          : 'New notice'
                        : isHw
                          ? 'Changed homework'
                          : 'Changed notice'}
                    </p>
                    {unread ? <StatusBadge tone="primary">New</StatusBadge> : null}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--sp-ink)]">
                    {item.subject ? `${item.subject} · ` : ''}
                    {item.title}
                  </p>
                  {lines[0] ? (
                    <p className="mt-1 text-sm text-[var(--sp-muted)]">{lines[0].heading}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-[var(--sp-muted)]">
                    {formatUpdateOccurredLabel(item.kind, item.occurredAt)}
                    {sourceDate ? ` · ${sourceDate}` : ''}
                  </p>
                  <div className="mt-2">
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-[var(--sp-primary)] hover:underline"
                    >
                      {isHw ? 'View homework →' : 'View notice →'}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-sm text-[var(--sp-muted)]">
            <Link href="/homework" className="font-medium text-[var(--sp-primary)] hover:underline">
              Homework
            </Link>
            {' · '}
            <Link href="/notices" className="font-medium text-[var(--sp-primary)] hover:underline">
              Notices
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

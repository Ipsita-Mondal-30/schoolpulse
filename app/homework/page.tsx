'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronDown, Paperclip } from 'lucide-react';
import {
  filterHomeworkBySection,
  sortHomeworkDatesNewestFirst,
  toSortableDate,
  type UiHomeworkItem,
} from '@/lib/ui-merge';
import {
  formatBriefDate,
  getIndiaToday,
  hasReliableDueDate,
} from '@/lib/daily-brief';
import { useHomeworkQuery } from '@/lib/queries/homework';
import { useParentAccessQuery } from '@/lib/queries/acknowledgements';
import AcknowledgeButton from '@/components/AcknowledgeButton';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';

const DEFAULT_SECTION = 'I-A';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const LINK_BANNER_DISMISS_KEY = 'schoolpulse_dismiss_link_banner';

type DueFilter = 'all' | 'today' | 'upcoming' | 'overdue';

function dueBucket(hw: UiHomeworkItem, today: string): DueFilter | 'none' {
  if (!hasReliableDueDate(hw.submissionDate)) return 'none';
  const due = toSortableDate(hw.submissionDate!);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

function sectionLabel(sec: string): string {
  const letter = sec.includes('-') ? sec.split('-')[1] : sec;
  return `Section ${letter}`;
}

function formatDateHeading(dateStr: string): string {
  try {
    const dateObj = new Date(`${dateStr}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    dateObj.setHours(12, 0, 0, 0);
    if (dateObj.getTime() === today.getTime()) {
      return `Today · ${formatBriefDate(dateStr)}`;
    }
    if (dateObj.getTime() === yesterday.getTime()) {
      return `Yesterday · ${formatBriefDate(dateStr)}`;
    }
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return formatBriefDate(dateStr) || dateStr;
  }
}

function previewText(hw: UiHomeworkItem): string {
  const description = hw.description?.trim() ?? '';
  const title = (hw.title || '').trim();
  if (!description || description === title) return '';
  return description;
}

export default function HomeworkPage() {
  const { data: session } = useSession();
  const isParent = session?.user?.role === 'parent';
  const { data: access } = useParentAccessQuery(Boolean(isParent));
  const { data, isPending, isError, error } = useHomeworkQuery();

  const [selectedSection, setSelectedSection] = useState(DEFAULT_SECTION);
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(true);

  const allHomework = data?.items ?? [];

  useEffect(() => {
    setToday(getIndiaToday());
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) {
      setSelectedSection(saved);
    }
    setBannerDismissed(localStorage.getItem(LINK_BANNER_DISMISS_KEY) === '1');
  }, []);

  useEffect(() => {
    if (isError) console.error('Failed to fetch homework sources', error);
  }, [isError, error]);

  const bySection = useMemo(
    () => filterHomeworkBySection(allHomework, selectedSection),
    [allHomework, selectedSection],
  );

  const filterCounts = useMemo(() => {
    if (!today) {
      return { all: bySection.length, today: 0, upcoming: 0, overdue: 0 };
    }
    let todayN = 0;
    let upcomingN = 0;
    let overdueN = 0;
    for (const hw of bySection) {
      const b = dueBucket(hw, today);
      if (b === 'today') todayN += 1;
      else if (b === 'upcoming') upcomingN += 1;
      else if (b === 'overdue') overdueN += 1;
    }
    return {
      all: bySection.length,
      today: todayN,
      upcoming: upcomingN,
      overdue: overdueN,
    };
  }, [bySection, today]);

  const filteredList = useMemo(() => {
    if (dueFilter === 'all' || !today) return bySection;
    return bySection.filter((hw) => dueBucket(hw, today) === dueFilter);
  }, [bySection, dueFilter, today]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, UiHomeworkItem[]> = {};
    for (const hw of filteredList) {
      const key = toSortableDate(hw.sentDate) || hw.sentDate || 'undated';
      if (!groups[key]) groups[key] = [];
      groups[key].push(hw);
    }
    const dates = sortHomeworkDatesNewestFirst(Object.keys(groups));
    return dates.map((date) => ({ date, items: groups[date] }));
  }, [filteredList]);

  const showLinkBanner =
    isParent && access && !access.hasApprovedLink && !bannerDismissed;

  const onSectionChange = (sec: string) => {
    setSelectedSection(sec);
    localStorage.setItem(PINNED_SECTION_KEY, sec);
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(LINK_BANNER_DISMISS_KEY, '1');
  };

  return (
    <div className="sp-page">
      <PageHeader
        title="Homework"
        subtitle={`Class 1 · ${sectionLabel(selectedSection)}`}
        actions={
          <label className="block">
            <span className="sp-section mb-1.5 block">Section</span>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="min-h-10 min-w-[7.5rem] rounded-xl border border-[var(--sp-border)] bg-white px-3 text-sm font-semibold text-[var(--sp-ink)] shadow-sm sp-focus"
            >
              {ALL_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {showLinkBanner ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-100 bg-[var(--sp-warn-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-snug text-[var(--sp-ink)]">
            Your child hasn&apos;t been linked yet. Acknowledgements will become
            available once your school completes the setup.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/info"
              className="text-xs font-semibold text-[var(--sp-primary)] hover:underline sp-focus rounded"
            >
              Learn more
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="text-xs font-semibold text-[var(--sp-muted)] hover:text-[var(--sp-ink)] sp-focus rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {isError ? (
        <div className="mb-5 sp-card p-4">
          <p className="text-sm font-semibold text-[var(--sp-error)]">
            Couldn&apos;t load homework.
          </p>
          <p className="sp-meta mt-1">Check your connection and try refreshing.</p>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          tabs={[
            { id: 'today', label: 'Today', count: filterCounts.today },
            { id: 'upcoming', label: 'Upcoming', count: filterCounts.upcoming },
            { id: 'all', label: 'All', count: filterCounts.all },
            { id: 'overdue', label: 'Overdue', count: filterCounts.overdue },
          ]}
          value={dueFilter}
          onChange={setDueFilter}
        />
        {!isPending && filteredList.length > 0 ? (
          <p className="text-xs font-medium text-[var(--sp-subtle)] sm:text-right">
            {filteredList.length} assignment{filteredList.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <LoadingState rows={5} />
      ) : filteredList.length === 0 ? (
        <div>
          <EmptyState
            title={
              dueFilter === 'today'
                ? 'No homework due today'
                : dueFilter === 'upcoming'
                  ? 'Nothing upcoming'
                  : dueFilter === 'overdue'
                    ? 'No overdue homework'
                    : 'No homework here'
            }
            description={
              dueFilter === 'today'
                ? "You're all caught up."
                : dueFilter !== 'all' && filterCounts.all > 0
                  ? `Try All to see ${filterCounts.all} assigned item${
                      filterCounts.all === 1 ? '' : 's'
                    } for this section.`
                  : `Nothing for section ${selectedSection} yet.`
            }
          />
          {dueFilter !== 'all' && filterCounts.all > 0 ? (
            <button
              type="button"
              onClick={() => setDueFilter('all')}
              className="mt-4 text-sm font-semibold text-[var(--sp-primary)] hover:underline sp-focus rounded"
            >
              Show all homework
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByDate.map(({ date, items }) => (
            <section key={date}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-bold tracking-wide text-[var(--sp-ink)]">
                  {date === 'undated'
                    ? 'Date not specified'
                    : formatDateHeading(date)}
                </h2>
                <div className="h-px flex-1 bg-[var(--sp-border)]" aria-hidden />
                <span className="text-[11px] font-medium tabular-nums text-[var(--sp-subtle)]">
                  {items.length}
                </span>
              </div>

              <ul className="space-y-2.5">
                {items.map((hw) => {
                  const open = expandedId === hw.id;
                  const bucket = today ? dueBucket(hw, today) : 'none';
                  const dueLabel = hw.submissionDate
                    ? bucket === 'today'
                      ? 'Due today'
                      : bucket === 'overdue'
                        ? `Overdue · ${formatBriefDate(hw.submissionDate)}`
                        : `Due ${formatBriefDate(hw.submissionDate)}`
                    : undefined;
                  const preview = previewText(hw);
                  const heading = hw.title?.trim() || preview || 'Homework';

                  return (
                    <li key={hw.id}>
                      <article
                        className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
                          open
                            ? 'border-orange-200 shadow-sm'
                            : 'border-[var(--sp-border)] hover:border-orange-100 hover:shadow-sm'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : hw.id)}
                          className="flex w-full items-start gap-3 px-4 py-3.5 text-left sp-focus"
                          aria-expanded={open}
                        >
                          <span
                            className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-[var(--sp-primary)]/70"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--sp-primary)]">
                                {hw.subject}
                              </span>
                              {hw.attachmentImage ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sp-subtle)]">
                                  <Paperclip className="h-3 w-3" aria-hidden />
                                  Attachment
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[15px] font-semibold leading-snug text-[var(--sp-ink)]">
                              {heading}
                            </p>
                            {!open && preview && hw.title ? (
                              <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-[var(--sp-muted)]">
                                {preview}
                              </p>
                            ) : null}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              {dueLabel ? (
                                <StatusBadge
                                  tone={
                                    bucket === 'overdue'
                                      ? 'error'
                                      : bucket === 'today'
                                        ? 'warn'
                                        : 'default'
                                  }
                                >
                                  {dueLabel}
                                </StatusBadge>
                              ) : null}
                              <span className="text-xs text-[var(--sp-subtle)]">
                                Assigned {formatBriefDate(hw.sentDate) || hw.sentDate}
                              </span>
                            </div>
                          </div>
                          <ChevronDown
                            className={`mt-1 h-4 w-4 shrink-0 text-[var(--sp-subtle)] transition-transform duration-200 ${
                              open ? 'rotate-180 text-[var(--sp-primary)]' : ''
                            }`}
                            aria-hidden
                          />
                        </button>

                        {open ? (
                          <div className="space-y-3 border-t border-[var(--sp-border)] bg-[var(--sp-bg)]/50 px-4 py-4 pl-[1.75rem] sm:pl-[1.85rem]">
                            {hw.description ? (
                              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sp-ink)]/90">
                                {hw.description}
                              </p>
                            ) : (
                              <p className="text-sm text-[var(--sp-muted)]">
                                No additional details from the school.
                              </p>
                            )}
                            {hw.submissionDate ? (
                              <p className="sp-meta">
                                Due {formatBriefDate(hw.submissionDate)}
                              </p>
                            ) : null}
                            {hw.attachmentImage ? (
                              <a
                                href={hw.attachmentImage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={hw.attachmentImage}
                                  alt="Homework attachment"
                                  className="max-h-64 w-auto rounded-xl border border-[var(--sp-border)]"
                                />
                              </a>
                            ) : null}
                            <AcknowledgeButton kind="homework" itemId={hw.id} />
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

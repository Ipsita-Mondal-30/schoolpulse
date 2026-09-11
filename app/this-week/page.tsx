'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  dueLabelForItem,
  type ThisWeekDayBucket,
  type ThisWeekHomeworkItem,
} from '@/lib/this-week';
import {
  formatWeekRangeLabel,
  getDayOfWeekMon1,
  type WorkloadLevel,
} from '@/lib/week-range';
import { useThisWeekQuery } from '@/lib/queries/this-week';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HomeworkItem } from '@/components/ui/HomeworkItem';
import { LoadingState } from '@/components/ui/LoadingState';

const DEFAULT_SECTION = 'I-A';
const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const ALL_SECTIONS = [
  'I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K',
];

const WEEKDAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const WORKLOAD_DOTS: { level: WorkloadLevel; color: string; label: string }[] = [
  { level: 'Light', color: '#22c55e', label: 'Light' },
  { level: 'Moderate', color: '#f59e0b', label: 'Medium' },
  { level: 'Heavy', color: '#c2410c', label: 'Heavy' },
];

function dayParts(ymd: string): { weekday: string; dayNum: string } {
  const dow = getDayOfWeekMon1(ymd);
  const dayNum = ymd.split('-')[2]?.replace(/^0/, '') || '';
  return {
    weekday: dow ? WEEKDAYS_SHORT[dow - 1] : '',
    dayNum,
  };
}

function workloadFilled(level: WorkloadLevel): number {
  if (level === 'Heavy') return 3;
  if (level === 'Moderate') return 2;
  return 1;
}

function WorkloadDots({ level }: { level: WorkloadLevel }) {
  const filled = workloadFilled(level);
  return (
    <span className="flex items-center gap-1" aria-label={`${level} workload`} title={level}>
      {WORKLOAD_DOTS.map((dot, i) => (
        <span
          key={dot.level}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: i < filled ? dot.color : '#e5e7eb',
          }}
        />
      ))}
    </span>
  );
}

function taskCountLabel(count: number): string {
  if (count === 0) return 'Nothing due';
  return `${count} task${count === 1 ? '' : 's'}`;
}

function DayRow({
  day,
  today,
  expanded,
  onToggle,
}: {
  day: ThisWeekDayBucket;
  today: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const empty = day.count === 0;
  const { weekday, dayNum } = dayParts(day.date);
  const active = day.isToday;

  const rowClass = active
    ? 'border-[var(--sp-primary)] bg-[var(--sp-primary-soft)]'
    : 'border-[var(--sp-border)] bg-[var(--sp-surface)]';

  const inkClass = active ? 'text-[var(--sp-primary)]' : 'text-[var(--sp-ink)]';
  const mutedClass = active ? 'text-[var(--sp-primary)]' : 'text-[var(--sp-muted)]';
  const subtleClass = active ? 'text-[var(--sp-primary)]/70' : 'text-[var(--sp-subtle)]';

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${rowClass}`}>
      {empty ? (
        <div className="flex items-center gap-4 px-4 py-3.5">
          <div className="w-10 shrink-0 text-center">
            <p className={`text-[10px] font-semibold tracking-wider ${subtleClass}`}>
              {weekday}
            </p>
            <p className={`text-lg font-semibold leading-none mt-0.5 ${inkClass}`}>
              {dayNum}
            </p>
          </div>
          <p className={`text-sm ${subtleClass}`}>{taskCountLabel(0)}</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left sp-focus"
          >
            <div className="w-10 shrink-0 text-center">
              <p className={`text-[10px] font-semibold tracking-wider ${subtleClass}`}>
                {weekday}
              </p>
              <p className={`text-lg font-semibold leading-none mt-0.5 ${inkClass}`}>
                {dayNum}
              </p>
            </div>
            <p className={`flex-1 text-sm font-medium ${mutedClass}`}>
              {taskCountLabel(day.count)}
            </p>
            <WorkloadDots level={day.workload} />
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${
                active ? 'text-[var(--sp-primary)]' : 'text-[var(--sp-subtle)]'
              } ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {expanded ? (
            <div className="px-2 pb-2 border-t border-[var(--sp-border)]/60 animate-[fadeIn_0.2s_ease-out]">
              <div className="pt-1 space-y-0.5">
                {day.items.map((item: ThisWeekHomeworkItem) => (
                  <HomeworkItem
                    key={item.id}
                    subject={item.subject}
                    title={item.title}
                    dueLabel={dueLabelForItem(item, today)}
                    href="/homework"
                    status={day.isToday ? 'today' : 'upcoming'}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function OverdueRow({
  items,
  count,
  today,
  expanded,
  onToggle,
}: {
  items: ThisWeekHomeworkItem[];
  count: number;
  today: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-100 bg-[var(--sp-error-soft)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left sp-focus"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--sp-error)] shrink-0" aria-hidden />
        <span className="flex-1 text-sm font-semibold text-[var(--sp-error)]">Overdue</span>
        <span className="text-sm font-medium text-[var(--sp-error)]">
          {count} task{count === 1 ? '' : 's'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--sp-error)] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="px-2 pb-2 border-t border-red-100/80 animate-[fadeIn_0.2s_ease-out]">
          <div className="pt-1 space-y-0.5">
            {items.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                dueLabel={dueLabelForItem(item, today)}
                href="/homework"
                status="overdue"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ThisWeekPage() {
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [showAllUndated, setShowAllUndated] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);
  const { data, isPending, isError, refetch } = useThisWeekQuery({ section });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved && ALL_SECTIONS.includes(saved)) setSection(saved);
  }, []);

  useEffect(() => {
    if (!data || initialized) return;
    const next: Record<string, boolean> = {};
    if (data.overdueCount > 0) next.overdue = true;
    const today = data.days.find((d) => d.isToday);
    if (today && today.count > 0) next[today.date] = true;
    setExpanded(next);
    setInitialized(true);
  }, [data, initialized]);

  if (isPending) {
    return (
      <div className="sp-page">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page">
        <p className="text-sm font-semibold">Couldn&apos;t load this week&apos;s homework.</p>
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

  if (!data) {
    return (
      <div className="sp-page">
        <LoadingState rows={6} />
      </div>
    );
  }

  const undatedVisible = showAllUndated
    ? data.dateNotSpecified
    : data.dateNotSpecified.slice(0, 5);
  const undatedHidden = data.dateNotSpecified.length - undatedVisible.length;

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sp-page max-w-lg mx-auto">
      <PageHeader
        title="This Week"
        subtitle={formatWeekRangeLabel(data.weekStart, data.weekEnd)}
      />

      {data.nothingDueThisWeek && data.overdueCount === 0 ? (
        <div className="mb-6">
          <EmptyState
            title={
              data.hasUndated
                ? 'Nothing with a deadline this week'
                : "You're all caught up"
            }
            description={
              data.hasUndated
                ? `${data.undatedCount} without a school-provided deadline.`
                : 'Nothing is due this week.'
            }
          />
        </div>
      ) : null}

      <div className="space-y-2.5">
        {data.overdueCount > 0 ? (
          <OverdueRow
            items={data.overdue}
            count={data.overdueCount}
            today={data.today}
            expanded={Boolean(expanded.overdue)}
            onToggle={() => toggle('overdue')}
          />
        ) : null}

        {data.days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            today={data.today}
            expanded={Boolean(expanded[day.date])}
            onToggle={() => toggle(day.date)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-[var(--sp-subtle)]">
        {WORKLOAD_DOTS.map((dot) => (
          <span key={dot.level} className="inline-flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: dot.color }}
              aria-hidden
            />
            {dot.label}
          </span>
        ))}
      </div>

      {data.dateNotSpecified.length > 0 ? (
        <section className="mt-10 mb-6">
          <SectionHeader label="Date not specified" />
          <p className="sp-meta mb-2">No deadline provided by school</p>
          <div className="sp-card py-1">
            {undatedVisible.map((item) => (
              <HomeworkItem
                key={item.id}
                subject={item.subject}
                title={item.title}
                href="/homework"
              />
            ))}
          </div>
          {undatedHidden > 0 && !showAllUndated ? (
            <button
              type="button"
              onClick={() => setShowAllUndated(true)}
              className="mt-2 text-xs font-semibold text-[var(--sp-primary)] hover:underline sp-focus rounded"
            >
              Show {undatedHidden} more
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="mt-8 flex justify-center">
        <Link
          href="/homework"
          className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-[var(--sp-primary)] text-white text-sm font-semibold hover:bg-orange-600 sp-focus"
        >
          View all homework
        </Link>
      </div>
    </div>
  );
}

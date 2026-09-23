'use client';

import { useMemo, useState } from 'react';
import { Download, ExternalLink, GraduationCap } from 'lucide-react';
import { getIndiaToday, addDaysYmd } from '@/lib/daily-brief';
import { useJolQuery } from '@/lib/queries/jol';
import { useCanonicalScheduleQuery } from '@/lib/queries/schedule';
import { useSyncedChildSection } from '@/lib/queries/synced-child';
import type { UiJolItem } from '@/app/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';

function formatYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || 'Undated';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isPrintout(item: UiJolItem): boolean {
  return (
    item.resourceType === 'printout' ||
    item.resourceType === 'pdf' ||
    item.resourceType === 'worksheet' ||
    Boolean(item.downloadUrl?.match(/\.pdf(\?|$)/i))
  );
}

function primaryHref(item: UiJolItem): string | null {
  return item.downloadUrl || item.resourceUrl || null;
}

function itemMatchesSection(item: UiJolItem, section: string): boolean {
  if (!item.sections || item.sections.length === 0) return true;
  return item.sections.includes(section) || item.sections.includes('ALL');
}

function JolCard({ item }: { item: UiJolItem }) {
  const href = primaryHref(item);
  const extra = item.media.filter((m) => {
    const u = m.downloadUrl || m.mediaUrl;
    return u && u !== href;
  });

  return (
    <li className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
        {item.subjectName || (isPrintout(item) ? 'Printout' : 'Resource')}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--sp-ink)]">{item.title}</p>
      {item.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--sp-muted)]">{item.description}</p>
      ) : null}
      <p className="mt-1.5 text-xs text-[var(--sp-muted)]">
        {formatYmd(item.publishedDate || item.activityDate)}
        {item.publishedTime && item.publishedTime !== '00:00' ? ` · ${item.publishedTime}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
          >
            {isPrintout(item) ? (
              <>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open
              </>
            )}
          </a>
        ) : null}
        {extra.slice(0, 3).map((m, i) => {
          const u = m.downloadUrl || m.mediaUrl;
          if (!u) return null;
          return (
            <a
              key={`${item.id}-extra-${i}`}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--sp-primary)] hover:underline"
            >
              File {i + 2}
            </a>
          );
        })}
      </div>
    </li>
  );
}

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function JoyOfLearningPage() {
  const { data, isPending, isError, refetch } = useJolQuery();
  const scheduleQuery = useCanonicalScheduleQuery();
  const { section, studentName } = useSyncedChildSection();
  const [filter, setFilter] = useState<'all' | 'jol'>('jol');
  const today = getIndiaToday();
  const horizon = addDaysYmd(today, 21) || today;

  const items = useMemo(() => {
    const list = (data ?? []).filter((i) => itemMatchesSection(i, section));
    return filter === 'jol' ? list.filter((i) => i.jolRelated) : list;
  }, [data, filter, section]);

  const upcoming = useMemo(() => {
    return items.filter((i) => {
      const d = i.activityDate || i.publishedDate;
      return d >= today && d <= horizon;
    });
  }, [items, today, horizon]);

  const printouts = useMemo(() => items.filter(isPrintout), [items]);
  const resources = useMemo(() => items.filter((i) => !isPrintout(i)), [items]);

  const jolSchedule = scheduleQuery.data?.jolSchedule ?? null;
  const scheduleEvents = scheduleQuery.data?.events ?? [];
  const hasDates =
    Boolean(jolSchedule?.days?.length) || scheduleEvents.length > 0;

  const childHint = studentName
    ? `Worksheet dates and school resources for ${studentName}.`
    : "Worksheet dates and school resources for your child's class.";

  return (
    <div className="sp-page max-w-3xl">
      <PageHeader
        title="Joy of Learning"
        subtitle="Activities, resources and printouts from your school"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFilter('jol')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold sp-focus ${
                filter === 'jol'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'border border-[var(--sp-border)] bg-white text-[var(--sp-ink)]'
              }`}
            >
              JOL
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold sp-focus ${
                filter === 'all'
                  ? 'bg-[var(--sp-primary)] text-white'
                  : 'border border-[var(--sp-border)] bg-white text-[var(--sp-ink)]'
              }`}
            >
              All library
            </button>
          </div>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-[24px] bg-[var(--sp-primary-soft)]/60 px-5 py-4">
        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sp-primary)]" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-[var(--sp-ink)]">Joy of Learning</p>
          <p className="mt-0.5 text-sm text-[var(--sp-muted)]">{childHint}</p>
        </div>
      </div>

      {isPending || scheduleQuery.isPending ? (
        <LoadingState rows={5} />
      ) : isError ? (
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load Joy of Learning.</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
              void scheduleQuery.refetch();
            }}
            className="mt-3 rounded-xl bg-[var(--sp-primary)] px-4 py-2 text-sm font-semibold text-white sp-focus"
          >
            Retry
          </button>
        </div>
      ) : (data?.length ?? 0) === 0 && !hasDates ? (
        <EmptyState
          title="No Joy of Learning materials yet"
          description="When the school shares JOL resources, they will appear here."
        />
      ) : (
        <div className="space-y-8">
          <Section title="Timetable" empty={!hasDates}>
            {jolSchedule?.days?.length ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--sp-ink)]">
                    {jolSchedule.title || 'Joy of Learning II — Timetable'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--sp-muted)]">
                    Class I
                    {jolSchedule.academicYear ? ` · ${jolSchedule.academicYear}` : ''}
                  </p>
                  {jolSchedule.sourceDocumentUrl ? (
                    <a
                      href={jolSchedule.sourceDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      View school timetable
                    </a>
                  ) : null}
                </div>
                <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
                  {jolSchedule.days.map((row) => (
                    <li
                      key={row.activityDate}
                      className="border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[var(--sp-ink)]">
                          {formatYmd(row.activityDate)}
                          {row.weekday ? ` · ${row.weekday}` : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--sp-muted)]">{row.classI}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : scheduleEvents.length > 0 ? (
              <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
                {scheduleEvents.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
                  >
                    <span className="text-sm text-[var(--sp-ink)]">
                      {row.subjectName || row.title}
                      {row.periodLabel ? ` · ${row.periodLabel}` : ''}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--sp-muted)]">
                      {formatYmd(row.eventDate)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Upcoming" empty={upcoming.length === 0}>
            <ul className="space-y-3">
              {upcoming.map((item) => (
                <JolCard key={item.id} item={item} />
              ))}
            </ul>
          </Section>

          <Section title="Printouts" empty={printouts.length === 0}>
            <ul className="space-y-3">
              {printouts.map((item) => (
                <JolCard key={item.id} item={item} />
              ))}
            </ul>
          </Section>

          <Section title="Resources" empty={resources.length === 0}>
            <ul className="space-y-3">
              {resources.map((item) => (
                <JolCard key={item.id} item={item} />
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}

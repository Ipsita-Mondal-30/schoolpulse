'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, GraduationCap } from 'lucide-react';
import { getIndiaToday, addDaysYmd } from '@/lib/daily-brief';
import { useJolQuery } from '@/lib/queries/jol';
import { useCanonicalScheduleQuery } from '@/lib/queries/schedule';
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

function JolCard({ item }: { item: UiJolItem }) {
  const href = primaryHref(item);
  const extra = item.media.filter((m) => {
    const u = m.downloadUrl || m.mediaUrl;
    return u && u !== href;
  });

  return (
    <li className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
        {item.subjectName || item.resourceType}
        {item.jolRelated ? ' · JOL' : ''}
        {item.scheduleDocument ? ' · Schedule doc' : ''}
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

function FreshnessBanner({
  status,
  lastSuccessAt,
  lastAttemptAt,
  errorSummary,
}: {
  status: string | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  errorSummary: string;
}) {
  return (
    <p className="text-xs text-[var(--sp-muted)]">
      NeverSkip sync:{' '}
      <span className="font-semibold text-[var(--sp-ink)]">{status || 'unknown'}</span>
      {lastSuccessAt ? ` · last success ${new Date(lastSuccessAt).toLocaleString('en-IN')}` : ''}
      {lastAttemptAt ? ` · last attempt ${new Date(lastAttemptAt).toLocaleString('en-IN')}` : ''}
      {status && status !== 'COMPLETE' && errorSummary ? ` · ${errorSummary.slice(0, 120)}` : ''}
    </p>
  );
}

export default function JoyOfLearningPage() {
  const { data, isPending, isError, refetch } = useJolQuery();
  const scheduleQuery = useCanonicalScheduleQuery();
  const [filter, setFilter] = useState<'all' | 'jol'>('jol');
  const today = getIndiaToday();
  const horizon = addDaysYmd(today, 21) || today;

  const items = useMemo(() => {
    const list = data ?? [];
    return filter === 'jol' ? list.filter((i) => i.jolRelated) : list;
  }, [data, filter]);

  const upcoming = useMemo(() => {
    return items.filter((i) => {
      const d = i.activityDate || i.publishedDate;
      return d >= today && d <= horizon;
    });
  }, [items, today, horizon]);

  const printouts = useMemo(() => items.filter(isPrintout), [items]);
  const resources = useMemo(() => items.filter((i) => !isPrintout(i)), [items]);
  const recent = useMemo(() => items.slice(0, 12), [items]);

  const scheduleEvents = scheduleQuery.data?.events ?? [];
  const jolSchedule = scheduleQuery.data?.jolSchedule ?? null;
  const scheduleDocs = (scheduleQuery.data?.documents ?? []).filter(
    (d) => d.scheduleDocument || /timetable|newsletter/i.test(d.title),
  );
  const freshness = scheduleQuery.data?.freshness;
  const hasDates =
    Boolean(jolSchedule?.days?.length) || scheduleEvents.length > 0 || scheduleDocs.length > 0;

  return (
    <div className="sp-page max-w-3xl">
      <PageHeader
        title="Joy of Learning"
        subtitle="Activities, resources and printouts from your school"
        actions={
          <div className="flex gap-2">
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
          <p className="text-sm font-semibold text-[var(--sp-ink)]">From NeverSkip Content Library</p>
          <p className="mt-0.5 text-sm text-[var(--sp-muted)]">
            Live resources synced from the parent app. Dates use the active Joy of Learning
            worksheet timetable from the school newsletter document — not static Worksheet I JSON.
          </p>
          {freshness ? (
            <div className="mt-2">
              <FreshnessBanner
                status={freshness.lastStatus}
                lastSuccessAt={freshness.lastSuccessAt}
                lastAttemptAt={freshness.lastAttemptAt}
                errorSummary={freshness.errorSummary}
              />
            </div>
          ) : null}
          <Link
            href="https://parent.neverskip.com/default/content-library"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-[var(--sp-primary)] hover:underline"
          >
            Open NeverSkip Content Library →
          </Link>
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
          description="When the school shares JOL resources in NeverSkip Content Library or Calendar, they will appear here after sync."
        />
      ) : (
        <div className="space-y-8">
          <Section title="Upcoming" empty={upcoming.length === 0}>
            <ul className="space-y-3">
              {upcoming.map((item) => (
                <JolCard key={`up-${item.id}`} item={item} />
              ))}
            </ul>
          </Section>

          <Section title="Dates" empty={!hasDates}>
            {jolSchedule?.days?.length ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--sp-ink)]">{jolSchedule.title}</p>
                  <p className="mt-1 text-xs text-[var(--sp-muted)]">
                    {jolSchedule.classesLabel}
                    {jolSchedule.academicYear ? ` · ${jolSchedule.academicYear}` : ''}
                    {' · '}
                    active
                    {jolSchedule.syncedAt
                      ? ` · synced ${new Date(jolSchedule.syncedAt).toLocaleString('en-IN')}`
                      : ''}
                  </p>
                  {jolSchedule.sourceDocumentUrl ? (
                    <a
                      href={jolSchedule.sourceDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open source newsletter
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
                      <p className="mt-1 text-sm text-[var(--sp-muted)]">
                        Class I — {row.classI}
                        <span className="mx-2 text-[var(--sp-subtle)]">·</span>
                        Class II — {row.classII}
                      </p>
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
                    <span className="shrink-0 text-sm text-[var(--sp-muted)]">
                      {row.eventDate || row.weekday || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {scheduleDocs.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {scheduleDocs.map((doc) => {
                  const href = doc.downloadUrl || doc.resourceUrl;
                  return (
                    <li
                      key={doc.id}
                      className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[var(--sp-ink)]">{doc.title}</p>
                      <p className="mt-1 text-xs text-[var(--sp-muted)]">
                        {formatYmd(doc.publishedDate)} · NeverSkip document
                      </p>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <p className="text-xs text-[var(--sp-muted)]">
              Current JoL Dates come from the active worksheet timetable (newsletter document), not
              static July Worksheet I JSON.
            </p>
          </Section>

          <Section title="Printouts" empty={printouts.length === 0}>
            <ul className="space-y-3">
              {printouts.slice(0, 20).map((item) => (
                <JolCard key={`pr-${item.id}`} item={item} />
              ))}
            </ul>
          </Section>

          <Section title="Resources" empty={resources.length === 0}>
            <ul className="space-y-3">
              {resources.slice(0, 20).map((item) => (
                <JolCard key={`re-${item.id}`} item={item} />
              ))}
            </ul>
          </Section>

          <Section title="Updates" empty={recent.length === 0}>
            <ul className="space-y-3">
              {recent.map((item) => (
                <JolCard key={`rc-${item.id}`} item={item} />
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}

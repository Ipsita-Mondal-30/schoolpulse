'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useCanonicalScheduleQuery } from '@/lib/queries/schedule';

function formatYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || 'Undated';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TimetablePage() {
  const { data, isPending, isError, refetch } = useCanonicalScheduleQuery();

  if (isPending) {
    return (
      <div className="sp-page max-w-3xl">
        <PageHeader title="Timetable" subtitle="School schedule and worksheet dates" />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sp-page max-w-3xl">
        <PageHeader title="Timetable" subtitle="School schedule and worksheet dates" />
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load timetable.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-xl bg-[var(--sp-primary)] px-4 py-2 text-sm font-semibold text-white sp-focus"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const events = data?.events ?? [];
  const jolSchedule = data?.jolSchedule ?? null;
  const documents = (data?.documents ?? []).filter(
    (d) => d.scheduleDocument || /timetable|newsletter/i.test(d.title),
  );
  const hasContent =
    Boolean(jolSchedule?.days?.length) || events.length > 0 || documents.length > 0;

  return (
    <div className="sp-page max-w-3xl">
      <PageHeader
        title="Timetable"
        subtitle="Worksheet dates and school calendar"
      />

      <div className="mb-6 space-y-1 rounded-[24px] bg-[var(--sp-primary-soft)]/50 px-5 py-4">
        <p className="text-sm text-[var(--sp-muted)]">
          Joy of Learning worksheet dates and calendar periods for your child&apos;s class.
        </p>
        <Link
          href="/joy-of-learning"
          className="inline-block text-sm font-semibold text-[var(--sp-primary)] hover:underline"
        >
          Open Joy of Learning →
        </Link>
      </div>

      {!hasContent ? (
        <EmptyState
          title="No timetable published yet"
          description="When the school publishes Joy of Learning worksheet dates or calendar periods, they will appear here."
        />
      ) : (
        <div className="space-y-8">
          {jolSchedule?.days?.length ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
                Joy of Learning timetable
              </h2>
              <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[var(--sp-ink)]">
                  {jolSchedule.title || 'Joy of Learning II — Timetable'}
                </p>
                <p className="mt-1 text-xs text-[var(--sp-muted)]">
                  {jolSchedule.classesLabel || 'Class I & II'}
                  {jolSchedule.academicYear ? ` · ${jolSchedule.academicYear}` : ''}
                </p>
                {jolSchedule.sourceDocumentUrl ? (
                  <a
                    href={jolSchedule.sourceDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
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
                    <p className="mt-1 text-sm text-[var(--sp-muted)]">
                      Class I — {row.classI}
                      <span className="mx-2 text-[var(--sp-subtle)]">·</span>
                      Class II — {row.classII}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {events.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
                Calendar events
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
                {events.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--sp-ink)]">
                        {row.subjectName || row.title}
                      </p>
                      <p className="text-xs text-[var(--sp-muted)]">
                        {[
                          row.weekday,
                          row.periodLabel,
                          row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-[var(--sp-muted)]">
                      {row.eventDate ? formatYmd(row.eventDate) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {documents.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
                Schedule documents
              </h2>
              <ul className="space-y-3">
                {documents.map((doc) => {
                  const href = doc.downloadUrl || doc.resourceUrl;
                  return (
                    <li
                      key={doc.id}
                      className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[var(--sp-ink)]">{doc.title}</p>
                      <p className="mt-1 text-xs text-[var(--sp-muted)]">
                        {formatYmd(doc.publishedDate)}
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
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

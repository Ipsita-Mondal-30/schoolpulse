'use client';

import { ExternalLink } from 'lucide-react';
import { getIndiaToday } from '@/lib/daily-brief';
import type { CanonicalJolSchedule } from '@/lib/schedule/canonical';
import { jolTimetableStatus, type OfficialTimetable } from '@/lib/schedule/official-timetable';

function formatYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || 'Undated';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function JolTimetable({
  schedule,
  official,
}: {
  schedule: CanonicalJolSchedule;
  official: OfficialTimetable | null;
}) {
  const today = getIndiaToday();
  const status = jolTimetableStatus(schedule.days, today, official);
  const documentUrl = official?.url ?? schedule.sourceDocumentUrl;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[var(--sp-ink)]">
          {schedule.title || 'Joy of Learning — Timetable'}
        </p>
        <p className="mt-1 text-xs text-[var(--sp-muted)]">
          Class I
          {schedule.academicYear ? ` · ${schedule.academicYear}` : ''}
          {official ? ` · Published by the school ${formatYmd(official.publishedDate)}` : ''}
        </p>
        {status?.state === 'completed' && !status.newerOfficialPublished ? (
          <p className="mt-2 text-sm text-[var(--sp-muted)]">
            Completed on {formatYmd(status.lastDate)}. This is the latest Joy of Learning timetable the
            school has published on NeverSkip.
          </p>
        ) : status?.next ? (
          <p className="mt-2 text-sm text-[var(--sp-ink)]">
            Next: {formatYmd(status.next.activityDate)} · {status.next.label}
          </p>
        ) : null}
        {status?.newerOfficialPublished && official ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The school published a newer timetable on {formatYmd(official.publishedDate)}. The dates below
            are from the previous timetable. Open the school&apos;s PDF for the new dates.
          </p>
        ) : null}
        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View school timetable (PDF)
          </a>
        ) : null}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
        {schedule.days.map((row) => {
          const past = row.activityDate < today;
          const isNext = status?.next?.activityDate === row.activityDate;
          return (
            <li
              key={row.activityDate}
              className={`border-b border-[var(--sp-border)] px-4 py-3 last:border-0 ${past ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--sp-ink)]">
                  {formatYmd(row.activityDate)}
                  {row.weekday ? ` · ${row.weekday}` : ''}
                </span>
                {isNext ? (
                  <span className="rounded-full bg-[var(--sp-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sp-primary)]">
                    Next
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--sp-muted)]">{row.classI}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

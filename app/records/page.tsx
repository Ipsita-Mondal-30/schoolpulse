'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { loadStudentRecords, type StudentRecordsView } from '@/app/actions/student-records';

const TITLE = 'Attendance & reports';
const SUBTITLE = 'From NeverSkip, for your child only';

function formatYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || 'Undated';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRupees(value: number | null): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function countLabel(value: number | null): string {
  return value == null ? 'Not recorded yet' : String(value);
}

function Gate({ state }: { state: Exclude<StudentRecordsView['state'], 'ok'> }) {
  if (state === 'signed_out') {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Sign in to see attendance and reports"
          description="These records are private to your child."
        />
        <Link
          href="/login"
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--sp-primary)] text-sm font-semibold text-white sp-focus"
        >
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <EmptyState
      title="Not available for this account"
      description={
        state === 'not_configured'
          ? 'Attendance, report cards and fees are hidden until the school admin allows specific parent accounts.'
          : 'This account is not on the list of parents allowed to see these records.'
      }
    />
  );
}

export default function RecordsPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['student-records'],
    queryFn: () => loadStudentRecords(),
  });

  if (isPending) {
    return (
      <div className="sp-page max-w-3xl">
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="sp-page max-w-3xl">
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load records.</p>
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

  if (data.state !== 'ok') {
    return (
      <div className="sp-page max-w-3xl">
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <Gate state={data.state} />
      </div>
    );
  }

  const recorded = data.attendance.filter((m) => m.absentDays != null);
  const absentSoFar = recorded.reduce((n, m) => n + (m.absentDays ?? 0), 0);
  const lateSoFar = recorded.reduce((n, m) => n + (m.lateDays ?? 0), 0);
  const hasAnything = data.attendance.length > 0 || data.reportCards.length > 0 || data.fees;

  return (
    <div className="sp-page max-w-3xl">
      <PageHeader title={TITLE} subtitle={SUBTITLE} />

      {!hasAnything ? (
        <EmptyState
          title="Nothing synced yet"
          description="Attendance, report cards and fees appear here after the next NeverSkip sync."
        />
      ) : (
        <div className="space-y-8">
          {data.attendance.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
                Attendance{data.academicYear ? ` · ${data.academicYear}` : ''}
              </h2>
              <div className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[var(--sp-ink)]">
                  {absentSoFar === 0 ? 'No absences recorded' : `${absentSoFar} day${absentSoFar === 1 ? '' : 's'} absent`}
                  {lateSoFar > 0 ? ` · ${lateSoFar} late` : ''}
                </p>
                <p className="mt-1 text-xs text-[var(--sp-muted)]">
                  {recorded.length > 0
                    ? `${recorded[0].month} to ${recorded[recorded.length - 1].month}, as recorded by the school`
                    : 'The school has not recorded attendance yet'}
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[var(--sp-border)] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--sp-border)] text-left text-xs text-[var(--sp-subtle)]">
                      <th className="px-4 py-2 font-semibold">Month</th>
                      <th className="px-2 py-2 font-semibold">Working days</th>
                      <th className="px-2 py-2 font-semibold">Holidays</th>
                      <th className="px-2 py-2 font-semibold">Absent</th>
                      <th className="px-4 py-2 font-semibold">Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map((m) => (
                      <tr key={m.month} className="border-b border-[var(--sp-border)] last:border-0">
                        <td className="px-4 py-2 font-semibold text-[var(--sp-ink)]">{m.month}</td>
                        <td className="px-2 py-2 text-[var(--sp-muted)]">{m.workingDays ?? '—'}</td>
                        <td className="px-2 py-2 text-[var(--sp-muted)]">{m.holidays ?? '—'}</td>
                        <td className="px-2 py-2 text-[var(--sp-muted)]">
                          {countLabel(m.absentDays)}
                          {m.absentDates ? <span className="block text-xs">{m.absentDates}</span> : null}
                        </td>
                        <td className="px-4 py-2 text-[var(--sp-muted)]">
                          {countLabel(m.lateDays)}
                          {m.lateDates ? <span className="block text-xs">{m.lateDates}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
              Report cards
            </h2>
            {data.reportCards.length === 0 ? (
              <p className="text-sm text-[var(--sp-muted)]">No report cards published yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.reportCards.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--sp-ink)]">{r.title}</p>
                    <p className="mt-1 text-xs text-[var(--sp-muted)]">{formatYmd(r.reportDate)}</p>
                    {r.reportUrl ? (
                      <a
                        href={r.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sp-primary)] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Open report card
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.fees ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
                Fees · {data.fees.academicYear}
              </h2>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  ['Paid', data.fees.paidAmount],
                  ['Total due', data.fees.totalDue],
                  ['Next due', data.fees.nextDue],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-[var(--sp-border)] bg-white px-4 py-3">
                    <dt className="text-xs text-[var(--sp-muted)]">{label}</dt>
                    <dd className="mt-1 text-base font-semibold text-[var(--sp-ink)]">
                      {formatRupees(value as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-[var(--sp-muted)]">
                As shown on NeverSkip{data.fees.nextDueLabel ? ` · ${data.fees.nextDueLabel}` : ''}. Pay and download
                receipts on the NeverSkip parent portal.
              </p>
            </section>
          ) : null}

          {data.updatedAt ? (
            <p className="text-xs text-[var(--sp-subtle)]">
              Last changed by a NeverSkip sync on{' '}
              {new Date(data.updatedAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

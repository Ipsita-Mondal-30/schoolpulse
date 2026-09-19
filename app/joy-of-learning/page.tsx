'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, GraduationCap } from 'lucide-react';
import { getIndiaToday, addDaysYmd } from '@/lib/daily-brief';
import { useJolQuery } from '@/lib/queries/jol';
import type { UiJolItem } from '@/app/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import jolPlanner from '@/data/info/joy-of-learning.json';
import { getMonthData } from '@/lib/data';

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

  const planner = getMonthData().joyOfLearning;
  const plannerDates = useMemo(() => {
    const rows: Array<{ label: string; date: string }> = [];
    const schedule = jolPlanner.timetable?.schedule ?? [];
    for (const row of schedule) {
      const date = String((row as { date?: string }).date ?? '').trim();
      const subject = String(
        (row as { classI?: string; subject?: string }).classI ||
          (row as { subject?: string }).subject ||
          '',
      ).trim();
      if (date) rows.push({ label: subject ? `Class I · ${subject}` : 'JOL session', date });
    }
    if (planner?.begins || planner?.startDate) {
      rows.unshift({
        label: planner.title || 'Joy of Learning begins',
        date: String(planner.begins || planner.startDate),
      });
    }
    if (planner?.ends || planner?.endDate) {
      rows.push({
        label: 'Joy of Learning ends',
        date: String(planner.ends || planner.endDate),
      });
    }
    return rows;
  }, [planner]);

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
            Live resources synced from the parent app. Open or download only when a school link is
            available.
          </p>
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

      {isPending ? (
        <LoadingState rows={5} />
      ) : isError ? (
        <div className="sp-card p-5">
          <p className="text-sm font-semibold">Couldn&apos;t load Joy of Learning.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-xl bg-[var(--sp-primary)] px-4 py-2 text-sm font-semibold text-white sp-focus"
          >
            Retry
          </button>
        </div>
      ) : (data?.length ?? 0) === 0 && plannerDates.length === 0 ? (
        <EmptyState
          title="No Joy of Learning materials yet"
          description="When the school shares JOL resources in NeverSkip Content Library, they will appear here after sync."
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

          <Section title="Dates" empty={plannerDates.length === 0}>
            <ul className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
              {plannerDates.map((row, idx) => (
                <li
                  key={`${row.date}-${idx}`}
                  className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3 last:border-0"
                >
                  <span className="text-sm text-[var(--sp-ink)]">{row.label}</span>
                  <span className="shrink-0 text-sm text-[var(--sp-muted)]">{row.date}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--sp-muted)]">
              Calendar dates from the school Class 1 planner (not invented).
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

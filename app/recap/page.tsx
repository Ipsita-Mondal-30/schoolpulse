'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RecapTopicCard } from '@/components/recap/RecapTopicCard';
import type { TodaysRecapResult } from '@/lib/recap/today';

const SECTION = 'I-A';

export default function RecapHubPage() {
  const [data, setData] = useState<TodaysRecapResult | null>(null);

  const refreshToday = useCallback(async (sec: string = SECTION) => {
    const qs = new URLSearchParams({ section: sec });
    const res = await fetch(`/api/recap/today?${qs.toString()}`);
    const json = (await res.json()) as TodaysRecapResult;
    setData(json);
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refreshToday(SECTION).catch(() => {
      if (!cancelled) {
        setData({
          status: 'empty',
          isHoliday: false,
          holidayName: null,
          topicCount: 0,
          topics: [],
          card: null,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToday]);

  const emptyCopy =
    data?.isHoliday && (data.topicCount ?? 0) === 0
      ? 'Nothing to recap today'
      : 'Nothing to recap yet';

  return (
    <main className="sp-page max-w-3xl">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
          Today&apos;s Recap
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--sp-ink)]">
          Review what was taught today
        </h1>
        <p className="mt-1 text-sm text-[var(--sp-muted)]">
          AI Video is a real Veo-generated clip. Interactive Practice is a separate
          quiz — not a video.
        </p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-[var(--sp-primary)]">
          ← Back to Home
        </Link>
      </header>

      {!data ? (
        <p className="text-sm text-[var(--sp-muted)]">Loading…</p>
      ) : data.topicCount === 0 ? (
        <section className="rounded-[28px] border border-dashed border-[var(--sp-border)] bg-white px-5 py-10 text-center">
          <p className="text-base font-semibold text-[var(--sp-ink)]">{emptyCopy}</p>
          <p className="mt-2 text-sm text-[var(--sp-muted)]">
            {data.isHoliday
              ? data.holidayName
                ? `School holiday — ${data.holidayName}.`
                : 'School holiday today.'
              : 'When homework has a clear learning topic, a recap will appear here.'}
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {data.topics.map((topic) => (
            <RecapTopicCard
              key={topic.homeworkId}
              topic={topic}
              onPracticeReady={() => void refreshToday(SECTION)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

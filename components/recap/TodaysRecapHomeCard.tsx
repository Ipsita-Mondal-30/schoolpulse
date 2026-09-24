'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Sparkles } from 'lucide-react';
import type { TodaysRecapResult } from '@/lib/recap/today';

function isSameIndiaDay(iso: string, todayYmd: string): boolean {
  try {
    const d = new Date(iso);
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return ymd === todayYmd;
  } catch {
    return false;
  }
}

export default function TodaysRecapHomeCard({
  section,
  todayYmd,
}: {
  section: string;
  todayYmd: string;
}) {
  const [data, setData] = useState<TodaysRecapResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ section });
    if (todayYmd) qs.set('today', todayYmd);
    void fetch(`/api/recap/today?${qs.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as TodaysRecapResult;
        if (!cancelled) setData(json);
      })
      .catch(() => {
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
  }, [section, todayYmd]);

  // Home card never auto-calls Gemini or Veo — opens /recap for AI Video + Practice.
  const loading = data === null;
  const topicCount = data?.topicCount ?? 0;
  const emptyCopy =
    data?.isHoliday && topicCount === 0
      ? 'Nothing to recap today'
      : topicCount === 0
        ? 'Nothing to recap yet'
        : null;
  const topicsLabel =
    topicCount > 0
      ? `${topicCount} topic${topicCount === 1 ? '' : 's'} available`
      : emptyCopy;

  const attemptToday =
    data?.card?.attempt &&
    todayYmd &&
    isSameIndiaDay(data.card.attempt.completedAt, todayYmd)
      ? data.card.attempt
      : null;

  const card = data?.card;
  const videoReady = card?.videoStatus === 'READY' && card.videoUrl;
  const videoGenerating =
    card &&
    (card.videoStatus === 'GENERATING' ||
      card.videoStatus === 'PLANNING' ||
      card.videoStatus === 'QUEUED' ||
      card.videoStatus === 'PENDING');

  return (
    <section className="rounded-[28px] bg-[#EEF9F3] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
            Today&apos;s Recap
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--sp-ink)]">
            Review what was taught today
          </p>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">
            {loading ? "Checking today's homework…" : topicsLabel}
          </p>
          {card && topicCount === 1 ? (
            <p className="mt-1 text-sm text-[var(--sp-muted)]">
              {card.subject} · {card.topic}
            </p>
          ) : null}
          {card && topicCount === 1 ? (
            <p className="mt-1 text-xs text-[var(--sp-muted)]">
              {videoReady
                ? 'AI Video ready · Interactive practice available'
                : videoGenerating
                  ? 'AI Video generating… · Interactive practice separate'
                  : 'AI Video + Interactive Practice (separate)'}
            </p>
          ) : null}
          {attemptToday ? (
            <p className="mt-2 text-sm text-[var(--sp-muted)]">
              Practice: {attemptToday.total} questions · {attemptToday.score} correct · Completed
              today
            </p>
          ) : null}
        </div>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-emerald-500">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/recap"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--sp-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 sp-focus"
        >
          {videoReady ? (
            <>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Watch AI Video
            </>
          ) : (
            'Open Recap →'
          )}
        </Link>
        <Link
          href="/recap"
          className="text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-ink)] sp-focus"
        >
          AI Video &amp; Practice
        </Link>
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
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
  const router = useRouter();
  const [data, setData] = useState<TodaysRecapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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

  const start = useCallback(async () => {
    if (!data) return;
    setError(null);

    // Always reach a real Recap route — hub lists topics or empty state.
    if (data.topicCount === 0 || data.topicCount > 1 || !data.card) {
      router.push('/recap');
      return;
    }

    setStarting(true);
    try {
      if (data.card.lessonId) {
        router.push(`/recap/${data.card.lessonId}`);
        return;
      }
      const res = await fetch('/api/recap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeworkId: data.card.homeworkId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        lessonId?: string;
        message?: string;
        reason?: string;
      };
      if (json.ok && json.lessonId) {
        router.push(`/recap/${json.lessonId}`);
        return;
      }
      setError(
        json.reason === 'ineligible'
          ? "SchoolPulse couldn't create a recap for this homework."
          : json.message || "Recap isn't available yet. Please try again.",
      );
      // Open hub so the parent can retry from the topic list.
      router.push('/recap');
    } catch {
      setError("Recap isn't available yet. Please try again.");
      router.push('/recap');
    } finally {
      setStarting(false);
    }
  }, [data, router]);

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
          {data?.card && topicCount === 1 ? (
            <p className="mt-1 text-sm text-[var(--sp-muted)]">
              {data.card.subject} · {data.card.topic}
            </p>
          ) : null}
          {attemptToday ? (
            <p className="mt-2 text-sm text-[var(--sp-muted)]">
              {attemptToday.total} questions · {attemptToday.score} correct · Completed today
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-amber-700">{error}</p> : null}
        </div>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-emerald-500">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void start()}
          disabled={starting || loading}
          className="inline-flex items-center rounded-xl bg-[var(--sp-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 sp-focus"
        >
          {starting ? 'Preparing…' : 'Start recap →'}
        </button>
        <Link
          href="/recap"
          className="text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-ink)] sp-focus"
        >
          Open Recap
        </Link>
      </div>
    </section>
  );
}

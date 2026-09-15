'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TodaysRecapResult } from '@/lib/recap/today';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';

export default function RecapHubPage() {
  const router = useRouter();
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [data, setData] = useState<TodaysRecapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved) setSection(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ section });
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
  }, [section]);

  const openTopic = useCallback(
    async (homeworkId: string, lessonId: string | null) => {
      setError(null);
      if (lessonId) {
        router.push(`/recap/${lessonId}`);
        return;
      }
      setBusyId(homeworkId);
      try {
        const res = await fetch('/api/recap/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeworkId }),
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
            : json.message || "Recap isn't available yet.",
        );
      } catch {
        setError("Recap isn't available yet.");
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

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
          Short lessons from today&apos;s school homework — when the topic is clear.
        </p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-[var(--sp-primary)]">
          ← Back to Home
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : null}

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
            <li
              key={topic.homeworkId}
              className="rounded-[24px] bg-white px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
            >
              <p className="text-sm font-semibold text-[var(--sp-ink)]">
                {topic.subject} · {topic.topic}
              </p>
              <p className="mt-1 text-sm text-[var(--sp-muted)]">
                {topic.lessonId
                  ? `${topic.questionCount ?? 3} questions · Ready`
                  : 'Ready to generate · 3 min'}
              </p>
              <button
                type="button"
                disabled={busyId === topic.homeworkId}
                onClick={() => void openTopic(topic.homeworkId, topic.lessonId)}
                className="mt-3 inline-flex items-center text-sm font-semibold text-[var(--sp-primary)] hover:underline disabled:opacity-60 sp-focus"
              >
                {busyId === topic.homeworkId
                  ? 'Preparing…'
                  : topic.lessonId
                    ? 'Open lesson →'
                    : 'Start recap →'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

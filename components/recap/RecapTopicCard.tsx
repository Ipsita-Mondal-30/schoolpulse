'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Sparkles, X } from 'lucide-react';
import type { RecapTopicSummary, RecapVideoStatus } from '@/lib/recap/today';

type VideoPayload = {
  status: RecapVideoStatus | 'PENDING';
  videoUrl?: string;
  message?: string;
  title?: string;
  subject?: string;
};

function isVideoInProgress(status: string | undefined): boolean {
  return (
    status === 'QUEUED' ||
    status === 'PENDING' ||
    status === 'PLANNING' ||
    status === 'GENERATING'
  );
}

/**
 * One homework topic with TWO clearly separated actions:
 * 1) AI Video (Veo) — real generated MP4
 * 2) Interactive Practice — Gemini quiz/cards (not a video)
 */
export function RecapTopicCard({
  topic,
  onPracticeReady,
}: {
  topic: RecapTopicSummary;
  onPracticeReady?: () => void;
}) {
  const router = useRouter();
  const [video, setVideo] = useState<VideoPayload | null>(
    topic.videoStatus !== 'NONE'
      ? {
          status: topic.videoStatus,
          videoUrl: topic.videoUrl || undefined,
        }
      : null,
  );
  const [videoBusy, setVideoBusy] = useState(false);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const loadVideo = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/homework/${encodeURIComponent(topic.homeworkId)}/video`,
        { method: 'GET', credentials: 'include' },
      );
      if (!res.ok) return;
      const json = (await res.json()) as VideoPayload;
      setVideo(json);
    } catch {
      /* ignore */
    }
  }, [topic.homeworkId]);

  useEffect(() => {
    void loadVideo();
  }, [loadVideo]);

  const status = video?.status || topic.videoStatus || 'NONE';
  const videoUrl = video?.videoUrl || topic.videoUrl || undefined;

  useEffect(() => {
    if (!isVideoInProgress(status)) return;
    const t = setInterval(() => {
      void loadVideo();
    }, 4000);
    return () => clearInterval(t);
  }, [status, loadVideo]);

  const startVideo = async () => {
    setVideoBusy(true);
    setVideoError(null);
    try {
      const res = await fetch(
        `/api/homework/${encodeURIComponent(topic.homeworkId)}/video`,
        { method: 'POST', credentials: 'include' },
      );
      const json = (await res.json()) as VideoPayload & { error?: string };
      if (!res.ok) {
        setVideoError(
          json.error ||
            "We couldn't generate this AI video right now. Please try again later.",
        );
        return;
      }
      setVideo(json);
      if (json.status === 'READY' && json.videoUrl) setModalOpen(true);
    } catch {
      setVideoError(
        "We couldn't generate this AI video right now. Please try again later.",
      );
    } finally {
      setVideoBusy(false);
    }
  };

  const startPractice = async () => {
    setPracticeError(null);
    if (topic.lessonId) {
      router.push(`/recap/${topic.lessonId}`);
      return;
    }
    setPracticeBusy(true);
    try {
      const res = await fetch('/api/recap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeworkId: topic.homeworkId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        lessonId?: string;
        message?: string;
        reason?: string;
      };
      if (json.ok && json.lessonId) {
        onPracticeReady?.();
        router.push(`/recap/${json.lessonId}`);
        return;
      }
      setPracticeError(
        json.reason === 'ineligible'
          ? "SchoolPulse couldn't create interactive practice for this homework."
          : json.message || 'Interactive practice isn’t available yet. Please try again.',
      );
    } catch {
      setPracticeError(
        'Interactive practice isn’t available yet. Please try again.',
      );
    } finally {
      setPracticeBusy(false);
    }
  };

  const videoInFlight = videoBusy || isVideoInProgress(status);

  return (
    <li className="rounded-[24px] bg-white px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <p className="text-sm font-semibold text-[var(--sp-ink)]">
        {topic.subject} · {topic.topic}
      </p>

      <div className="mt-4 space-y-4">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
            AI Video
          </p>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">
            Short Veo-generated revision clip — not the quiz below.
          </p>
          <div className="mt-2">
            {status === 'READY' && videoUrl ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--sp-primary)] px-3 py-2 text-sm font-semibold text-white sp-focus"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                Watch AI Video
              </button>
            ) : videoInFlight ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sp-primary)]">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                {status === 'PLANNING'
                  ? 'Preparing video script…'
                  : 'Generating AI video…'}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void startVideo()}
                disabled={videoBusy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--sp-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-primary-soft)]/50 sp-focus disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {status === 'FAILED' ? 'Retry AI Video' : 'Generate AI Video'}
              </button>
            )}
          </div>
          {status === 'FAILED' || videoError ? (
            <p className="mt-2 text-xs text-amber-800">
              {videoError ||
                video?.message ||
                "AI video couldn't be generated yet (often provider quota). You can retry."}
            </p>
          ) : null}
        </section>

        <section className="border-t border-[var(--sp-border)] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
            Interactive Practice
          </p>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">
            {topic.lessonId
              ? `${topic.questionCount ?? 3} questions · text & quiz cards`
              : 'Gemini practice cards & quiz — separate from the video.'}
          </p>
          <button
            type="button"
            disabled={practiceBusy}
            onClick={() => void startPractice()}
            className="mt-2 inline-flex items-center text-sm font-semibold text-[var(--sp-primary)] hover:underline disabled:opacity-60 sp-focus"
          >
            {practiceBusy
              ? 'Preparing practice…'
              : topic.lessonId
                ? 'Start Practice →'
                : 'Generate Practice →'}
          </button>
          {practiceError ? (
            <p className="mt-2 text-xs text-amber-800">{practiceError}</p>
          ) : null}
        </section>
      </div>

      {modalOpen && videoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="AI homework video"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                  {video?.subject || topic.subject}
                </p>
                <p className="truncate text-sm font-semibold text-[var(--sp-ink)]">
                  {video?.title || topic.topic}
                </p>
                <p className="mt-0.5 text-xs text-[var(--sp-muted)]">
                  AI-generated video (Veo)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-[var(--sp-muted)] hover:bg-[var(--sp-primary-soft)]/50 sp-focus"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-black">
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

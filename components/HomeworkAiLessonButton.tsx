'use client';

import { useCallback, useEffect, useState } from 'react';
import { Play, Sparkles, X } from 'lucide-react';

type VideoStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PLANNING'
  | 'GENERATING'
  | 'READY'
  | 'FAILED';

type VideoPayload = {
  status: VideoStatus;
  videoUrl?: string;
  message?: string;
  title?: string;
  subject?: string;
};

export function HomeworkAiLessonButton({
  homeworkId,
  subject,
  title,
  enabled,
}: {
  homeworkId: string;
  subject: string;
  title: string;
  enabled: boolean;
}) {
  const [payload, setPayload] = useState<VideoPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`/api/homework/${encodeURIComponent(homeworkId)}/video`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = (await res.json()) as VideoPayload;
      setPayload(json);
    } catch {
      /* ignore */
    }
  }, [enabled, homeworkId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (
      !payload ||
      (payload.status !== 'GENERATING' &&
        payload.status !== 'PLANNING' &&
        payload.status !== 'QUEUED' &&
        payload.status !== 'PENDING')
    ) {
      return;
    }
    const t = setInterval(() => {
      void loadStatus();
    }, 4000);
    return () => clearInterval(t);
  }, [payload, loadStatus]);

  const startGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/homework/${encodeURIComponent(homeworkId)}/video`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as VideoPayload & { error?: string };
      if (!res.ok) {
        setError(json.error || "We couldn't create this lesson right now. Please try again later.");
        return;
      }
      setPayload(json);
      if (json.status === 'READY') setModalOpen(true);
    } catch {
      setError("We couldn't create this lesson right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  const status = payload?.status || 'PENDING';
  const inProgress =
    busy ||
    status === 'QUEUED' ||
    status === 'PENDING' ||
    status === 'PLANNING' ||
    status === 'GENERATING';

  return (
    <div className="mt-3 space-y-2">
      {status === 'READY' && payload?.videoUrl ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--sp-primary)] px-3 py-2 text-sm font-semibold text-white sp-focus"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Watch AI Video
        </button>
      ) : inProgress ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sp-primary)]">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
          {status === 'PLANNING' ? 'Preparing video script…' : 'Generating AI video…'}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void startGenerate()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--sp-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-primary-soft)]/50 sp-focus disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          {status === 'FAILED' ? 'Retry AI Video' : 'Generate AI Video'}
        </button>
      )}

      {status === 'FAILED' || error ? (
        <p className="text-xs text-[var(--sp-muted)]">
          {error ||
            payload?.message ||
            "AI video couldn't be generated yet. Please try again later."}
          {status === 'FAILED' ? (
            <>
              {' '}
              <button
                type="button"
                onClick={() => void startGenerate()}
                className="font-semibold text-[var(--sp-primary)] hover:underline"
              >
                Try again
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {modalOpen && payload?.videoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="AI lesson video"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-subtle)]">
                  {payload.subject || subject}
                </p>
                <p className="truncate text-sm font-semibold text-[var(--sp-ink)]">
                  {payload.title || title}
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
                key={payload.videoUrl}
                src={payload.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  const el = document.querySelector<HTMLVideoElement>(
                    `video[src="${payload.videoUrl}"]`,
                  );
                  if (el) {
                    el.currentTime = 0;
                    void el.play();
                  }
                }}
                className="text-sm font-semibold text-[var(--sp-primary)] hover:underline"
              >
                Replay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

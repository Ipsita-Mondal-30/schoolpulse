'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { MicroLessonScene } from '@/lib/recap/schema';

type Match = Extract<MicroLessonScene, { type: 'match' }>;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function MatchScene({
  scene,
  onSolved,
}: {
  scene: Match;
  onSolved: () => void;
}) {
  const rights = useMemo(
    () => shuffle(scene.pairs.map((p) => p.right)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shuffle once per scene prompt
    [scene.prompt],
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);

  function onLeft(left: string) {
    if (matched.has(left)) return;
    setSelectedLeft(left);
    setFeedback(null);
  }

  function onRight(right: string) {
    if (!selectedLeft) return;
    const pair = scene.pairs.find((p) => p.left === selectedLeft);
    if (!pair) return;
    if (pair.right === right) {
      const next = new Set(matched);
      next.add(selectedLeft);
      setMatched(next);
      setSelectedLeft(null);
      setFeedback('ok');
      if (next.size >= scene.pairs.length) {
        window.setTimeout(onSolved, 700);
      }
    } else {
      setFeedback('no');
      window.setTimeout(() => {
        setFeedback(null);
        setSelectedLeft(null);
      }, 900);
    }
  }

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="text-center text-2xl font-bold text-[var(--sp-ink)]">{scene.prompt}</h2>
      <p className="mt-2 text-center text-sm text-[var(--sp-muted)]">Tap a left card, then its match</p>
      <div className="mt-6 grid flex-1 grid-cols-2 gap-3">
        <div className="space-y-3">
          {scene.pairs.map((p) => {
            const done = matched.has(p.left);
            return (
              <button
                key={p.left}
                type="button"
                disabled={done}
                onClick={() => onLeft(p.left)}
                className={`min-h-14 w-full rounded-2xl px-3 py-3 text-lg font-bold sp-focus ${
                  done
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedLeft === p.left
                      ? 'bg-orange-200 text-[var(--sp-ink)] ring-2 ring-[var(--sp-primary)]'
                      : 'bg-white text-[var(--sp-ink)] ring-1 ring-orange-100'
                }`}
              >
                {p.left}
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          {rights.map((right) => {
            const done = scene.pairs.some((p) => matched.has(p.left) && p.right === right);
            return (
              <button
                key={right}
                type="button"
                disabled={done || !selectedLeft}
                onClick={() => onRight(right)}
                className={`min-h-14 w-full rounded-2xl px-3 py-3 text-lg font-bold sp-focus ${
                  done
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-white text-[var(--sp-ink)] ring-1 ring-orange-100 disabled:opacity-50'
                }`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      {feedback === 'ok' ? (
        <p className="mt-3 text-center font-bold text-emerald-600">Match!</p>
      ) : null}
      {feedback === 'no' ? (
        <p className="mt-3 text-center font-bold text-amber-600">Not quite — try again</p>
      ) : null}
    </motion.div>
  );
}

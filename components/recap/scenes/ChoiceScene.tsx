'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { MicroLessonScene } from '@/lib/recap/schema';
import RecapVisual from '@/components/recap/RecapVisual';

type ChoiceLike = Extract<MicroLessonScene, { type: 'choice' | 'find' }>;

export default function ChoiceScene({
  scene,
  onSolved,
}: {
  scene: ChoiceLike;
  onSolved: () => void;
}) {
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [locked, setLocked] = useState(false);

  function pick(index: number) {
    if (locked) return;
    setLocked(true);
    const correct = index === scene.answerIndex;
    setFeedback(correct ? 'correct' : 'incorrect');
    window.setTimeout(() => {
      if (correct) {
        onSolved();
        return;
      }
      setFeedback(null);
      setLocked(false);
    }, correct ? 900 : 1100);
  }

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="text-center text-2xl font-bold leading-snug text-[var(--sp-ink)]">
        {scene.prompt}
      </h2>
      <div className="mt-6 grid flex-1 gap-3">
        {scene.options.map((option, idx) => (
          <motion.button
            key={`${option}-${idx}`}
            type="button"
            disabled={locked}
            onClick={() => pick(idx)}
            whileTap={{ scale: 0.97 }}
            className="flex min-h-[4.5rem] items-center gap-4 rounded-[24px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-orange-100 sp-focus disabled:opacity-70"
          >
            <RecapVisual hint={scene.optionHints?.[idx] ?? 'star'} size="sm" />
            <span className="text-xl font-bold text-[var(--sp-ink)]">{option}</span>
          </motion.button>
        ))}
      </div>
      {feedback === 'correct' ? (
        <p className="mt-4 text-center text-lg font-bold text-emerald-600">Yes! 🎉</p>
      ) : null}
      {feedback === 'incorrect' ? (
        <p className="mt-4 text-center text-lg font-bold text-amber-600">Try again — you can do it!</p>
      ) : null}
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import RecapVisual from '@/components/recap/RecapVisual';
import type { VisualHint } from '@/lib/recap/schema';

export default function QuizScene({
  question,
  options,
  optionHints,
  questionIndex,
  total,
  onAnswer,
}: {
  question: string;
  options: string[];
  optionHints?: VisualHint[];
  questionIndex: number;
  total: number;
  onAnswer: (optionIndex: number) => Promise<'correct' | 'incorrect'>;
}) {
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [locked, setLocked] = useState(false);

  async function pick(index: number) {
    if (locked) return;
    setLocked(true);
    const result = await onAnswer(index);
    setFeedback(result);
    window.setTimeout(() => {
      setFeedback(null);
      setLocked(false);
    }, 1000);
  }

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-subtle)]">
        Quiz {questionIndex + 1} / {total}
      </p>
      <h2 className="mt-3 text-center text-2xl font-bold leading-snug text-[var(--sp-ink)]">
        {question}
      </h2>
      <div className="mt-6 grid flex-1 gap-3">
        {options.map((option, idx) => (
          <motion.button
            key={`${questionIndex}-${idx}`}
            type="button"
            disabled={locked}
            whileTap={{ scale: 0.97 }}
            onClick={() => void pick(idx)}
            className="flex min-h-[4.5rem] items-center gap-4 rounded-[24px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-orange-100 sp-focus disabled:opacity-70"
          >
            <RecapVisual hint={optionHints?.[idx] ?? 'sparkle'} size="sm" />
            <span className="text-xl font-bold text-[var(--sp-ink)]">{option}</span>
          </motion.button>
        ))}
      </div>
      {feedback === 'correct' ? (
        <p className="mt-4 text-center text-lg font-bold text-emerald-600">Awesome!</p>
      ) : null}
      {feedback === 'incorrect' ? (
        <p className="mt-4 text-center text-lg font-bold text-amber-600">Almost — keep going!</p>
      ) : null}
    </motion.div>
  );
}

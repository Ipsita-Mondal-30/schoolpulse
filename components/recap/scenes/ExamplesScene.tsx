'use client';

import { motion } from 'framer-motion';
import type { MicroLessonScene } from '@/lib/recap/schema';
import RecapVisual from '@/components/recap/RecapVisual';

type Examples = Extract<MicroLessonScene, { type: 'examples' }>;

export default function ExamplesScene({
  scene,
  onNext,
}: {
  scene: Examples;
  onNext: () => void;
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col px-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="text-center text-2xl font-bold text-[var(--sp-ink)]">Look!</h2>
      <div className="mt-6 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {scene.items.map((item, i) => (
          <motion.div
            key={`${item.label}-${i}`}
            className="flex flex-col items-center justify-center rounded-[28px] bg-white px-4 py-6 text-center shadow-sm ring-1 ring-orange-100"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 * i, type: 'spring', stiffness: 180, damping: 18 }}
          >
            <RecapVisual hint={item.visualHint ?? 'sparkle'} size="md" />
            <p className="mt-3 text-xl font-bold text-[var(--sp-ink)]">{item.label}</p>
          </motion.div>
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-6 min-h-12 self-center rounded-2xl bg-[var(--sp-primary)] px-8 text-base font-bold text-white sp-focus"
      >
        Next
      </button>
    </motion.div>
  );
}

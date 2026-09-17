'use client';

import { motion } from 'framer-motion';
import type { MicroLessonScene } from '@/lib/recap/schema';
import RecapVisual from '@/components/recap/RecapVisual';

type Teach = Extract<MicroLessonScene, { type: 'visual_teach' }>;

export default function TeachScene({
  scene,
  onNext,
}: {
  scene: Teach;
  onNext: () => void;
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center px-2 text-center"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <RecapVisual hint={scene.visualHint ?? 'abc'} size="lg" />
      <h2 className="mt-6 max-w-md text-3xl font-bold leading-tight text-[var(--sp-ink)]">
        {scene.headline}
      </h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {scene.bits.map((bit, i) => (
          <motion.span
            key={`${bit}-${i}`}
            className="rounded-2xl bg-white px-4 py-3 text-2xl font-bold text-[var(--sp-ink)] shadow-sm ring-1 ring-orange-100"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 * i, type: 'spring', stiffness: 220, damping: 16 }}
          >
            {bit}
          </motion.span>
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-10 min-h-12 rounded-2xl bg-[var(--sp-primary)] px-8 text-base font-bold text-white sp-focus"
      >
        Next
      </button>
    </motion.div>
  );
}

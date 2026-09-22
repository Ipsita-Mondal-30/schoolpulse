'use client';

import { motion } from 'framer-motion';
import RecapVisual from '@/components/recap/RecapVisual';

export default function CelebrationScene({
  message,
  score,
  total,
}: {
  message: string;
  score: number;
  total: number;
}) {
  return (
    <motion.div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 160, damping: 14 }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute text-2xl"
          initial={{ opacity: 0, y: 40, x: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [-20, -120 - (i % 5) * 18],
            x: ((i % 2 === 0 ? 1 : -1) * (20 + i * 8)) as number,
          }}
          transition={{ duration: 1.6, delay: i * 0.08, repeat: 1 }}
          style={{ left: `${8 + (i * 7) % 84}%`, bottom: '30%' }}
          aria-hidden
        >
          {i % 3 === 0 ? '⭐' : i % 3 === 1 ? '🎉' : '✨'}
        </motion.span>
      ))}

      <motion.div
        animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 0.8, repeat: 1 }}
      >
        <RecapVisual hint="star" size="xl" />
      </motion.div>
      <h2 className="mt-6 text-3xl font-bold text-[var(--sp-ink)] sm:text-4xl">
        You&apos;re a star! ⭐
      </h2>
      <p className="mt-3 max-w-sm text-lg font-semibold text-[var(--sp-muted)]">{message}</p>
      <p className="mt-6 rounded-full bg-white px-6 py-3 text-xl font-bold text-[var(--sp-ink)] shadow-sm ring-1 ring-orange-100">
        {score} / {total}
      </p>
      <a
        href="/"
        className="mt-8 min-h-12 rounded-2xl bg-[var(--sp-primary)] px-8 py-3 text-base font-bold text-white sp-focus"
      >
        Back to Home
      </a>
    </motion.div>
  );
}

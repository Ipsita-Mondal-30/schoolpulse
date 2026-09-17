'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { MicroLessonScene } from '@/lib/recap/schema';
import RecapVisual from '@/components/recap/RecapVisual';

type Intro = Extract<MicroLessonScene, { type: 'intro' }>;

export default function IntroScene({
  scene,
  onDone,
}: {
  scene: Intro;
  onDone: () => void;
}) {
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const ms = scene.durationMs ?? 3500;
    const t = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [scene.durationMs, scene.message, onDone]);

  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center px-2 text-center"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <RecapVisual hint={scene.visualHint ?? 'star'} size="xl" />
      </motion.div>
      <motion.p
        className="mt-8 max-w-sm text-2xl font-bold leading-snug text-[var(--sp-ink)] sm:text-3xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {scene.message}
      </motion.p>
      <button
        type="button"
        onClick={() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }}
        className="mt-10 min-h-12 rounded-2xl bg-[var(--sp-primary)] px-8 text-base font-bold text-white sp-focus"
      >
        Let&apos;s go!
      </button>
    </motion.div>
  );
}

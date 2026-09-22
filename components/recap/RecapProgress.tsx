'use client';

import { motion } from 'framer-motion';

export default function RecapProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.round((Math.min(current, total) / Math.max(total, 1)) * 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sp-subtle)]">
        <span>Let&apos;s play</span>
        <span>
          {Math.min(current, total)} / {total}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-orange-100">
        <motion.div
          className="h-full rounded-full bg-[var(--sp-primary)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

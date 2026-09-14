'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHomeworkQuery } from '@/lib/queries/homework';
import { filterHomeworkBySection } from '@/lib/ui-merge';
import { getIndiaToday, hasReliableDueDate, isDueToday } from '@/lib/daily-brief';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';

export default function HomeworkDuePopup() {
  const { data } = useHomeworkQuery();
  const [showPopup, setShowPopup] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 9) return;

    const todayStr = getIndiaToday();
    const section = localStorage.getItem(PINNED_SECTION_KEY) || DEFAULT_SECTION;
    const dueToday = filterHomeworkBySection(data?.items ?? [], section).filter(
      (hw) => hasReliableDueDate(hw.submissionDate) && isDueToday(hw.submissionDate, todayStr),
    );

    if (dueToday.length === 0) return;
    setTitles(dueToday.map((hw) => hw.title || hw.subject || 'Homework'));

    const hasSeen = sessionStorage.getItem(`seen_homework_popup_${todayStr}`);
    if (!hasSeen) setShowPopup(true);
  }, [data]);

  const handleDismiss = () => {
    setShowPopup(false);
    sessionStorage.setItem(`seen_homework_popup_${getIndiaToday()}`, 'true');
  };

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-[var(--sp-primary)] px-6 py-4">
          <h3 className="text-lg font-bold leading-tight text-white">Due today</h3>
          <p className="text-xs font-medium text-orange-100">Homework with a school due date today</p>
        </div>
        <div className="p-6">
          <ul className="mb-6 space-y-2">
            {titles.map((title) => (
              <li
                key={title}
                className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-semibold text-[var(--sp-ink)]"
              >
                {title}
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700"
            >
              Later
            </button>
            <Link
              href="/homework"
              onClick={handleDismiss}
              className="flex-1 rounded-xl bg-[var(--sp-primary)] px-4 py-2.5 text-center text-sm font-bold text-white"
            >
              Open Homework
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

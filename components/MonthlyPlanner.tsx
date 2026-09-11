'use client';

import { useState } from 'react';
import { PlannerSubject } from '@/lib/data';

function SubjectCard({
  subject,
  expanded,
  onToggle,
}: {
  subject: PlannerSubject;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--sp-border)] overflow-hidden bg-white">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--sp-bg)] transition-colors sp-focus"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--sp-ink)] text-sm leading-tight">
            {subject.subject}
          </h3>
          <p className="sp-meta mt-0.5">
            {subject.portions.length} topics · {subject.activities.length}{' '}
            {subject.activities.length === 1 ? 'activity' : 'activities'}
          </p>
        </div>
        <span
          className={`text-[var(--sp-subtle)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--sp-border)]">
          <div className="pt-3">
            <p className="sp-section mb-2">Portions</p>
            <ul className="space-y-1.5">
              {subject.portions.map((p, i) => (
                <li key={i} className="text-sm text-[var(--sp-ink)]/90 leading-snug pl-3 border-l-2 border-[var(--sp-border)]">
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="sp-section mb-2">Activities</p>
            <ul className="space-y-1.5">
              {subject.activities.map((a, i) => (
                <li key={i} className="text-sm text-[var(--sp-ink)]/90 leading-snug pl-3 border-l-2 border-orange-200">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MonthlyPlanner({
  subjects,
  month,
  year,
  className = '',
}: {
  subjects: PlannerSubject[];
  month: string;
  year: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className={className}>
      <p className="sp-meta mb-3">
        {month} {year}
      </p>
      <div className="space-y-2">
        {subjects.map((subject) => {
          const key = subject.subject;
          const isOpen = Boolean(expanded[key]);
          return (
            <SubjectCard
              key={key}
              subject={subject}
              expanded={isOpen}
              onToggle={() =>
                setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
              }
            />
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { PlannerSubject } from '@/lib/data';

const SUBJECT_CONFIG: Record<string, { icon: string; gradient: string; bg: string; border: string; badge: string }> = {
  'English':          { icon: '📖', gradient: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  'Mathematics':      { icon: '🔢', gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  'EVS':              { icon: '🌿', gradient: 'from-green-500 to-lime-600',     bg: 'bg-green-50',   border: 'border-green-200',   badge: 'bg-green-100 text-green-700' },
  'Hindi':            { icon: '🪷', gradient: 'from-orange-500 to-amber-500',   bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  'Kannada':          { icon: '🏛️', gradient: 'from-yellow-500 to-orange-400',  bg: 'bg-yellow-50',  border: 'border-yellow-200',  badge: 'bg-yellow-100 text-yellow-700' },
  'Computer Science': { icon: '💻', gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
};

const DEFAULT_CONFIG = { icon: '📚', gradient: 'from-gray-500 to-slate-600', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' };

// ── SubjectCard receives expanded state & toggle from parent ──────────────────
function SubjectCard({ subject, expanded, onToggle }: {
  subject: PlannerSubject;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = SUBJECT_CONFIG[subject.subject] || DEFAULT_CONFIG;

  return (
    <div className={`rounded-2xl border ${config.border} overflow-hidden shadow-sm hover:shadow-md transition-all duration-300`}>
      {/* Header — clickable */}
      <button
        className={`w-full flex items-center gap-3 p-4 ${config.bg} text-left`}
        onClick={onToggle}
      >
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-tight">{subject.subject}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {subject.portions.length} topics · {subject.activities.length} {subject.activities.length === 1 ? 'activity' : 'activities'}
          </p>
        </div>
        <span className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-4 bg-white space-y-4">
          <div>
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full mb-2 ${config.badge}`}>
              <span>📋</span> Portions
            </div>
            <ul className="space-y-1.5">
              {subject.portions.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-gradient-to-br ${config.gradient}`} />
                  <span className="leading-snug">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full mb-2 ${config.badge}`}>
              <span>⭐</span> Activities
            </div>
            <ul className="space-y-1.5">
              {subject.activities.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-base leading-none flex-shrink-0 mt-0.5">
                    {['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i] ?? '▪️'}
                  </span>
                  <span className="leading-snug">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MonthlyPlanner — owns all expanded state ──────────────────────────────────
interface MonthlyPlannerProps {
  subjects: PlannerSubject[];
  month: string;
  year: number;
  className?: string;
}

export default function MonthlyPlanner({ subjects, month, year, className = '' }: MonthlyPlannerProps) {
  const [expandedStates, setExpandedStates] = useState<boolean[]>(() => subjects.map(() => true));

  if (!subjects || subjects.length === 0) return null;

  const allExpanded = expandedStates.every(Boolean);

  const toggleAll = () => {
    const next = !allExpanded;
    setExpandedStates(subjects.map(() => next));
  };

  const toggleOne = (index: number) =>
    setExpandedStates(prev => prev.map((v, i) => (i === index ? !v : v)));

  return (
    <div className={className}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-base shadow-md">🗓️</div>
          <div>
            <h2 className="text-base font-black text-gray-900 leading-tight">{month} {year} Planner</h2>
            <p className="text-[10px] text-gray-400 font-medium">{subjects.length} subjects · Class 1</p>
          </div>
        </div>
        <button
          onClick={toggleAll}
          className="text-[10px] font-bold text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {subjects.map((subject, i) => (
          <SubjectCard
            key={subject.subject}
            subject={subject}
            expanded={expandedStates[i]}
            onToggle={() => toggleOne(i)}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import timetableData from '@/data/timetable.json';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const SUBJECT_STYLES: Record<string, string> = {
  green:   'bg-green-100 text-green-800 border-green-200',
  purple:  'bg-purple-100 text-purple-800 border-purple-200',
  blue:    'bg-blue-100 text-blue-800 border-blue-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  red:     'bg-red-100 text-red-800 border-red-200',
  cyan:    'bg-cyan-100 text-cyan-800 border-cyan-200',
  pink:    'bg-pink-100 text-pink-800 border-pink-200',
  indigo:  'bg-indigo-100 text-indigo-800 border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  yellow:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  rose:    'bg-rose-100 text-rose-800 border-rose-200',
  teal:    'bg-teal-100 text-teal-800 border-teal-200',
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  orange:  'bg-orange-100 text-orange-800 border-orange-200',
  lime:    'bg-lime-100 text-lime-800 border-lime-200',
};

function getSubjectStyle(code: string): string {
  const subj = timetableData.subjects[code as keyof typeof timetableData.subjects];
  return subj ? (SUBJECT_STYLES[subj.color] || SUBJECT_STYLES.slate) : SUBJECT_STYLES.slate;
}

function getSubjectFullName(code: string): string {
  const subj = timetableData.subjects[code as keyof typeof timetableData.subjects];
  return subj ? subj.fullName : code;
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getCurrentDayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
  if (jsDay === 0 || jsDay === 6) return 0; // weekend → show Monday
  return jsDay - 1; // 0=Mon, 1=Tue...
}

interface PeriodSlot {
  number?: number;
  startTime: string;
  endTime: string;
  type?: string;
  label?: string;
}

function isCurrentPeriod(period: PeriodSlot): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false; // weekend
  const [sh, sm] = period.startTime.split(':').map(Number);
  const [eh, em] = period.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
}

function isToday(dayName: string): boolean {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return today === dayName;
}

export default function TimetablePage() {
  const [selectedDay, setSelectedDay] = useState(getCurrentDayIndex());
  const [, setTick] = useState(0);

  // Re-render every minute to update current period highlight
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const periods = timetableData.periods as PeriodSlot[];
  const selectedDayName = DAYS[selectedDay];
  const daySubjects = timetableData.days[selectedDayName as keyof typeof timetableData.days];

  let subjectIndex = 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🕐</span>
          Timetable
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{timetableData.class} &middot; {timetableData.school}</p>
      </div>

      {/* Day Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {DAYS.map((day, idx) => (
          <button
            key={day}
            onClick={() => setSelectedDay(idx)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              idx === selectedDay
                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200'
                : isToday(day)
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {day.slice(0, 3)}
            {isToday(day) && idx !== selectedDay && (
              <span className="ml-1 text-[8px] font-medium uppercase">today</span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile: Vertical Timeline */}
      <div className="sm:hidden space-y-2">
        {periods.map((period, i) => {
          if (period.type === 'break') {
            return (
              <div key={`break-${i}`} className="flex items-center gap-3 py-2 px-1">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0">
                  {period.label} ({formatTime12(period.startTime)} – {formatTime12(period.endTime)})
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            );
          }

          const subjectCode = daySubjects[subjectIndex];
          subjectIndex++;
          const current = isCurrentPeriod(period) && isToday(selectedDayName);

          return (
            <div
              key={`p-${period.number}`}
              className={`flex items-stretch rounded-xl border transition-all ${
                current
                  ? 'border-orange-400 ring-2 ring-orange-100 shadow-md'
                  : 'border-gray-100'
              }`}
            >
              {/* Time Column */}
              <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-3 px-1 rounded-l-xl ${
                current ? 'bg-orange-50' : 'bg-gray-50'
              }`}>
                <span className={`text-[10px] font-bold ${current ? 'text-orange-600' : 'text-gray-400'}`}>
                  P{period.number}
                </span>
                <span className="text-[9px] text-gray-400 mt-0.5 leading-tight text-center">
                  {formatTime12(period.startTime)}
                </span>
              </div>

              {/* Subject */}
              <div className={`flex-1 flex items-center gap-2.5 px-3 py-3 rounded-r-xl ${
                current ? 'bg-orange-50/40' : 'bg-white'
              }`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border text-xs font-black ${getSubjectStyle(subjectCode)}`}>
                  {subjectCode.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">{subjectCode}</div>
                  <div className="text-[10px] text-gray-400">{getSubjectFullName(subjectCode)}</div>
                </div>
                {current && (
                  <span className="shrink-0 text-[9px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase animate-pulse">
                    Now
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Full Week Grid */}
      <div className="hidden sm:block">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-2.5 px-3 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 w-24">Time</th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className={`py-2.5 px-2 text-center text-[10px] font-black uppercase tracking-wider ${
                      isToday(day) ? 'text-orange-600 bg-orange-50/50' : 'text-gray-400'
                    }`}
                  >
                    {day.slice(0, 3)}
                    {isToday(day) && <span className="block text-[8px] font-medium normal-case">Today</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const periodCounters: Record<string, number> = {};
                DAYS.forEach(d => { periodCounters[d] = 0; });

                return periods.map((period, i) => {
                  if (period.type === 'break') {
                    return (
                      <tr key={`break-${i}`} className="bg-gray-50/60">
                        <td className="py-1.5 px-3 text-[10px] font-bold text-gray-400 border-t border-gray-100" colSpan={6}>
                          {period.label} &middot; {formatTime12(period.startTime)} – {formatTime12(period.endTime)}
                        </td>
                      </tr>
                    );
                  }

                  const current = isCurrentPeriod(period);
                  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

                  return (
                    <tr key={`p-${period.number}`} className={`border-t border-gray-50 ${current ? 'bg-orange-50/30' : ''}`}>
                      <td className="py-2 px-3">
                        <div className="text-[10px] font-bold text-gray-400">P{period.number}</div>
                        <div className="text-[9px] text-gray-300">{formatTime12(period.startTime)}</div>
                      </td>
                      {DAYS.map((day) => {
                        const subjects = timetableData.days[day as keyof typeof timetableData.days];
                        const idx = periodCounters[day];
                        const code = subjects[idx];
                        periodCounters[day]++;
                        const isCurrent = current && day === todayDay;

                        return (
                          <td key={day} className={`py-1.5 px-1.5 text-center ${isToday(day) ? 'bg-orange-50/20' : ''}`}>
                            <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-[11px] font-bold min-w-[52px] ${
                              getSubjectStyle(code)
                            } ${isCurrent ? 'ring-2 ring-orange-300 shadow-sm' : ''}`}>
                              {code}
                              {isCurrent && (
                                <span className="text-[7px] font-bold text-orange-600 uppercase animate-pulse">now</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-3 bg-white rounded-xl border border-gray-100">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Subjects</h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(timetableData.subjects).map(([code, info]) => {
            if (code === 'Maths' || code === 'Craft') return null;
            return (
              <span
                key={code}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold ${
                  getSubjectStyle(code)
                }`}
              >
                {code}
                {info.fullName !== code && <span className="font-normal opacity-70">· {info.fullName}</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] text-gray-400 mt-4">
        Saturday &amp; Sunday: No school
      </p>
    </div>
  );
}

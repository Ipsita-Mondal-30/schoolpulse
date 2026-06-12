'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMonthData, DaySchedule as DayScheduleType, getAvailableMonths, getCurrentMonthId, MonthInfo } from '@/lib/data';
import MonthSelector from '@/components/MonthSelector';
import revisionPlanData from '@/data/revision-plan.json';

interface RevisionActivity {
  subject: string;
  topic: string;
  guide: string;
  interactiveQuestion: string;
  funTask: string;
}

interface RevisionDay {
  day: string;
  focus: string;
  activities: RevisionActivity[];
}

const revisionPlan = revisionPlanData as RevisionDay[];

const SUBJECT_STYLING: Record<string, { icon: string; bg: string; border: string; text: string; gradient: string; activeTabBg: string }> = {
  'English': {
    icon: '📖',
    bg: 'bg-blue-50/40',
    border: 'border-blue-100',
    text: 'text-blue-800',
    gradient: 'from-blue-500 to-indigo-600',
    activeTabBg: 'bg-blue-600 text-white'
  },
  'Mathematics': {
    icon: '🔢',
    bg: 'bg-emerald-50/40',
    border: 'border-emerald-100',
    text: 'text-emerald-800',
    gradient: 'from-emerald-500 to-teal-600',
    activeTabBg: 'bg-emerald-600 text-white'
  },
  'EVS': {
    icon: '🌿',
    bg: 'bg-amber-50/40',
    border: 'border-amber-100',
    text: 'text-amber-800',
    gradient: 'from-amber-500 to-orange-600',
    activeTabBg: 'bg-amber-600 text-white'
  },
  'Hindi': {
    icon: '🪷',
    bg: 'bg-rose-50/40',
    border: 'border-rose-100',
    text: 'text-rose-800',
    gradient: 'from-rose-500 to-pink-600',
    activeTabBg: 'bg-rose-600 text-white'
  },
  'Kannada': {
    icon: '🏛️',
    bg: 'bg-purple-50/40',
    border: 'border-purple-100',
    text: 'text-purple-800',
    gradient: 'from-purple-500 to-indigo-600',
    activeTabBg: 'bg-purple-600 text-white'
  },
  'Computer Science': {
    icon: '💻',
    bg: 'bg-cyan-50/40',
    border: 'border-cyan-100',
    text: 'text-cyan-800',
    gradient: 'from-cyan-500 to-blue-600',
    activeTabBg: 'bg-cyan-600 text-white'
  }
};

const DEFAULT_STYLING = {
  icon: '📚',
  bg: 'bg-gray-50/40',
  border: 'border-gray-100',
  text: 'text-gray-800',
  gradient: 'from-gray-500 to-slate-600',
  activeTabBg: 'bg-gray-600 text-white'
};

function MonthViewContent() {
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get('month');

  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [monthInfo, setMonthInfo] = useState<{ month: string; year: number } | null>(null);
  const [daysMap, setDaysMap] = useState<Map<string, DayScheduleType>>(new Map());
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);

  // Toggle between calendar view and revision view
  const [activeTab, setActiveTab] = useState<'calendar' | 'revision'>('calendar');

  // Revision state
  const [completedActivities, setCompletedActivities] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 0: true });
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, 'guide' | 'question' | 'task'>>({});
  const [mounted, setMounted] = useState<boolean>(false);

  // Initialize months
  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    const defaultMonth = urlMonth || getCurrentMonthId();
    setSelectedMonthId(defaultMonth);
    setMounted(true);

    // If URL contains tab parameter or we check current month and default
    const urlTab = searchParams.get('tab');
    if (urlTab === 'revision') {
      setActiveTab('revision');
    }
  }, [searchParams, urlMonth]);

  // Load progress from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('class1-revision-progress-v1');
      if (saved) {
        try {
          setCompletedActivities(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading revision progress:', e);
        }
      }
    }
  }, []);

  // Handle URL month parameter changes
  useEffect(() => {
    if (urlMonth && availableMonths.length > 0) {
      setSelectedMonthId(urlMonth);
    }
  }, [urlMonth, availableMonths]);

  // Update data when month changes
  useEffect(() => {
    if (!selectedMonthId) return;

    const data = getMonthData(selectedMonthId);
    setMonthInfo({ month: data.month, year: data.year });

    const map = new Map<string, DayScheduleType>();
    for (const week of data.weeks) {
      for (const day of week.days) {
        map.set(day.date, day);
      }
    }
    setDaysMap(map);
  }, [selectedMonthId]);

  if (!monthInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Toggle activity completion
  const toggleActivity = (dayIndex: number, actIndex: number) => {
    const key = `${dayIndex}-${actIndex}`;
    const updated = { ...completedActivities, [key]: !completedActivities[key] };
    setCompletedActivities(updated);
    localStorage.setItem('class1-revision-progress-v1', JSON.stringify(updated));
  };

  // Toggle day collapse/expand
  const toggleDay = (idx: number) => {
    setExpandedDays(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Toggle sub-tab (Guide/Question/Task)
  const setSubTab = (dayIndex: number, actIndex: number, tab: 'guide' | 'question' | 'task') => {
    const key = `${dayIndex}-${actIndex}`;
    setActiveSubTabs(prev => ({ ...prev, [key]: tab }));
  };

  // Reset all progress
  const resetProgress = () => {
    if (confirm('Are you sure you want to reset all revision progress?')) {
      setCompletedActivities({});
      localStorage.removeItem('class1-revision-progress-v1');
    }
  };

  // Calculate statistics
  const totalActivitiesCount = revisionPlan.reduce((acc, curr) => acc + curr.activities.length, 0);
  const completedCount = mounted
    ? Object.keys(completedActivities).filter(key => completedActivities[key]).length
    : 0;
  const percent = totalActivitiesCount > 0 ? Math.round((completedCount / totalActivitiesCount) * 100) : 0;

  // Motivation message based on progress
  let motivationMsg = "Let's start the revision journey! You can do this! 🚀";
  if (percent === 100) {
    motivationMsg = "Fantastic! Your child is a Class 1 Champion! 🎉 Let's celebrate! 🥳";
  } else if (percent >= 70) {
    motivationMsg = "Excellent progress! Almost finished! 🏆";
  } else if (percent >= 40) {
    motivationMsg = "Awesome job! You're halfway there. Keep going! 🌟";
  } else if (percent > 0) {
    motivationMsg = "Great start! Tapping 'Mark as Mastered' keeps track of your progress. 👍";
  }

  // Generate calendar grid
  const year = monthInfo.year;
  const monthIndex = new Date(`${monthInfo.month} 1, ${year}`).getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const totalDays = lastDay.getDate();

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDateString = (day: number) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24">
      {/* Header & View Switcher Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <MonthSelector
            months={availableMonths}
            selectedMonthId={selectedMonthId}
            onMonthChange={setSelectedMonthId}
          />
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'calendar' ? 'Click on a day to see the schedule' : 'Structured parent-guided home teaching steps'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto self-start sm:self-center border border-gray-200">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-gray-800 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            🗓️ School Calendar
          </button>
          <button
            onClick={() => setActiveTab('revision')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'revision'
                ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            🏆 10-Day Revision Plan
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <>
          {/* Calendar Grid View */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {dayNames.map((name) => (
                <div
                  key={name}
                  className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return <div key={dayIndex} className="h-24 bg-gray-50/50" />;
                  }

                  const dateStr = getDateString(day);
                  const dayData = daysMap.get(dateStr);
                  const isHoliday = dayData?.isHoliday;
                  const hasSchedule = dayData && !isHoliday && dayData.schedule.length > 0;
                  const isWeekend = dayIndex === 0 || dayIndex === 6;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <Link
                      href={`/?date=${dateStr}`}
                      key={dayIndex}
                      className={`h-24 p-1.5 sm:p-2 border-r border-gray-100 last:border-r-0 hover:bg-orange-50/55 transition-colors ${
                        isWeekend && !hasSchedule ? 'bg-gray-50/30' : ''
                      } ${isToday ? 'ring-2 ring-orange-400 ring-inset' : ''}`}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                          <span
                            className={`text-xs font-semibold ${
                              isHoliday
                                ? 'text-orange-600'
                                : isWeekend
                                ? 'text-gray-400'
                                : 'text-gray-700'
                            }`}
                          >
                            {day}
                          </span>
                          {isToday && (
                            <span className="text-[9px] bg-orange-100 text-orange-800 font-bold px-1 rounded">
                              Today
                            </span>
                          )}
                        </div>
                        {isHoliday && (
                          <span className="text-[10px] text-orange-600 mt-1 line-clamp-2 leading-tight font-medium">
                            {dayData.holidayName}
                          </span>
                        )}

                        {hasSchedule && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Literacy"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Numeracy"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Languages"></span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              <span>Literacy (English)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
              <span>Numeracy (Maths)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              <span>Languages (Kannada/Hindi)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 ring-2 ring-orange-400 rounded-sm"></span>
              <span>Today</span>
            </div>
          </div>
        </>
      ) : (
        /* Innovative 10-Day Revision Plan View */
        <div className="space-y-6">
          {/* Progress Dashboard Card */}
          <div className="bg-gradient-to-br from-gray-905 to-slate-800 bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-orange-500/15 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 bg-pink-500/10 rounded-full blur-xl"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                    Home Schooling
                  </span>
                  <span className="bg-white/10 text-white/80 text-[10px] font-bold px-2 py-0.5 rounded">
                    Class 1 CBSE
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight mt-1">Class 1 Revision Tracker</h2>
                <p className="text-xs text-gray-300 max-w-md">
                  {motivationMsg}
                </p>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="flex flex-col items-end min-w-[160px] w-full md:w-auto">
                <div className="flex justify-between w-full text-xs font-bold mb-1.5">
                  <span className="text-gray-300">Overall Mastery</span>
                  <span className="text-orange-400">{percent}%</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden border border-gray-700">
                  <div
                    className="bg-gradient-to-r from-orange-400 via-rose-400 to-pink-500 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5 font-semibold flex items-center justify-between w-full">
                  <span>{completedCount} of {totalActivitiesCount} Topics Done</span>
                  {completedCount > 0 && (
                    <button
                      onClick={resetProgress}
                      className="text-red-400 hover:text-red-300 transition-colors font-bold"
                    >
                      Reset Progress
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 10-Day Collapsible Timeline */}
          <div className="space-y-4">
            {revisionPlan.map((dayItem, dayIdx) => {
              const isExpanded = expandedDays[dayIdx];
              // Calculate local completion count for the day pair
              const dayCompletedCount = dayItem.activities.filter((_, actIdx) =>
                completedActivities[`${dayIdx}-${actIdx}`]
              ).length;
              const isAllDone = dayCompletedCount === dayItem.activities.length;

              return (
                <div
                  key={dayIdx}
                  className={`border rounded-2xl bg-white transition-all overflow-hidden ${
                    isExpanded ? 'border-orange-200 shadow-md shadow-orange-500/5' : 'border-gray-100 shadow-sm'
                  }`}
                >
                  {/* Day Accordion Header */}
                  <button
                    onClick={() => toggleDay(dayIdx)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                      isExpanded ? 'bg-orange-50/20' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${
                          isAllDone
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
                            : isExpanded
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isAllDone ? '✓' : `D${dayIdx * 2 + 1}`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-sm leading-none">{dayItem.day}</h3>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.25 rounded-md ${
                              isAllDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : dayCompletedCount > 0
                                ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {dayCompletedCount}/{dayItem.activities.length} Mastered
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-medium leading-none">{dayItem.focus}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Day Content */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dayItem.activities.map((act, actIdx) => {
                        const styling = SUBJECT_STYLING[act.subject] || DEFAULT_STYLING;
                        const isCompleted = !!completedActivities[`${dayIdx}-${actIdx}`];
                        const activeSubTab = activeSubTabs[`${dayIdx}-${actIdx}`] || 'guide';

                        return (
                          <div
                            key={actIdx}
                            className={`rounded-2xl border flex flex-col justify-between transition-all ${
                              isCompleted
                                ? 'border-emerald-200 bg-emerald-50/10 shadow-sm'
                                : `${styling.border} bg-white shadow-sm`
                            }`}
                          >
                            {/* Card Header */}
                            <div className="p-4 pb-0">
                              <div className="flex justify-between items-start gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    isCompleted ? 'bg-emerald-100 text-emerald-700' : `${styling.bg} ${styling.text}`
                                  }`}
                                >
                                  <span>{styling.icon}</span> {act.subject}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold">Topic {actIdx + 1}</span>
                              </div>
                              <h4 className="font-bold text-gray-800 text-sm mt-2 leading-tight">
                                {act.topic}
                              </h4>
                            </div>

                            {/* Innovative Navigation Tabs Inside Card */}
                            <div className="px-4 mt-3">
                              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                <button
                                  onClick={() => setSubTab(dayIdx, actIdx, 'guide')}
                                  className={`flex-1 text-[10px] py-1 px-1.5 font-bold rounded-md transition-all ${
                                    activeSubTab === 'guide'
                                      ? 'bg-white text-gray-800 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  👨‍🏫 Explain
                                </button>
                                <button
                                  onClick={() => setSubTab(dayIdx, actIdx, 'question')}
                                  className={`flex-1 text-[10px] py-1 px-1.5 font-bold rounded-md transition-all ${
                                    activeSubTab === 'question'
                                      ? 'bg-white text-gray-800 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  💬 Ask
                                </button>
                                <button
                                  onClick={() => setSubTab(dayIdx, actIdx, 'task')}
                                  className={`flex-1 text-[10px] py-1 px-1.5 font-bold rounded-md transition-all ${
                                    activeSubTab === 'task'
                                      ? 'bg-white text-gray-800 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  🎨 Play
                                </button>
                              </div>
                            </div>

                            {/* Tab Content Box */}
                            <div className="px-4 py-3 flex-1 min-h-[90px]">
                              {activeSubTab === 'guide' && (
                                <div className="animate-fadeIn space-y-0.5">
                                  <span className="text-[8px] font-black uppercase text-blue-500 tracking-wider">Parent Instruction</span>
                                  <p className="text-xs text-gray-600 leading-snug">{act.guide}</p>
                                </div>
                              )}
                              {activeSubTab === 'question' && (
                                <div className="animate-fadeIn space-y-0.5 pl-2 border-l-2 border-orange-200">
                                  <span className="text-[8px] font-black uppercase text-orange-500 tracking-wider">Ask Your Child</span>
                                  <p className="text-xs text-gray-700 font-medium italic leading-snug">"{act.interactiveQuestion}"</p>
                                </div>
                              )}
                              {activeSubTab === 'task' && (
                                <div className="animate-fadeIn space-y-0.5">
                                  <span className="text-[8px] font-black uppercase text-emerald-500 tracking-wider">Fun Activity</span>
                                  <p className="text-xs text-gray-600 leading-snug">{act.funTask}</p>
                                </div>
                              )}
                            </div>

                            {/* Bottom Mastered Check Box Button */}
                            <div className="p-3 pt-0">
                              <button
                                onClick={() => toggleActivity(dayIdx, actIdx)}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                  isCompleted
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/10'
                                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                {isCompleted ? (
                                  <>
                                    <span>🌟 Mastered!</span>
                                    <span className="text-[9px] opacity-75 font-normal">(Tap to undo)</span>
                                  </>
                                ) : (
                                  <>
                                    <span>⬜ Mark as Mastered!</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonthPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <MonthViewContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DaySchedule from '@/components/DaySchedule';
import DictationWords from '@/components/DictationWords';
import MonthSelector from '@/components/MonthSelector';
import ImportantDates from '@/components/ImportantDates';
import ShareButton from '@/components/ShareButton';
import RecentUpdates from '@/components/RecentUpdates';
import AISuggestedRecap from '@/components/AISuggestedRecap';
import {
  getMonthData,
  getDaySchedule,
  getWeekForDate,
  formatDate,
  getAllDates,
  getAvailableMonths,
  getCurrentMonthId,
  getImportantDates,
  findMonthForDate,
  DaySchedule as DayScheduleType,
  WeekData,
  MonthInfo,
  ImportantDate,
  getToday,
} from '@/lib/data';

function HomeContent() {
  const searchParams = useSearchParams();
  const urlDate = searchParams.get('date');

  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dayData, setDayData] = useState<DayScheduleType | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [monthData, setMonthData] = useState<{ month: string; year: number; class: string } | null>(null);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [showAI, setShowAI] = useState<boolean>(false);

  // Initialize months
  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    setSelectedMonthId(getCurrentMonthId());
  }, []);

  // Handle URL date parameter changes
  useEffect(() => {
    if (urlDate && availableDates.includes(urlDate)) {
      setSelectedDate(urlDate);
    }
  }, [urlDate, availableDates]);

  // Update dates when month changes
  useEffect(() => {
    if (!selectedMonthId) return;

    const dates = getAllDates(selectedMonthId);
    setAvailableDates(dates);

    const today = getToday();

    // Priority 1: URL parameter (deep linking)
    if (urlDate) {
      // Check if URL date is in current month
      if (dates.includes(urlDate)) {
        setSelectedDate(urlDate);
      } else {
        // URL date is from a different month - find and switch to that month
        const correctMonth = findMonthForDate(urlDate);
        if (correctMonth && correctMonth !== selectedMonthId) {
          setSelectedMonthId(correctMonth);
          return; // Let the next effect handle setting the date
        } else if (correctMonth === selectedMonthId) {
          // Month is correct but date not found - use first date
          setSelectedDate(dates[0]);
        }
      }
    }
    // Priority 2: Today's date if it exists in this month (default behavior)
    else if (!urlDate && dates.includes(today)) {
      setSelectedDate(today);
    }
    // Priority 3: First available date (fallback)
    else if (!dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }

    const data = getMonthData(selectedMonthId);
    setMonthData({ month: data.month, year: data.year, class: data.class });
    setImportantDates(getImportantDates(selectedMonthId));
  }, [selectedMonthId, urlDate]);

  // Update day data when date changes
  useEffect(() => {
    if (selectedDate && selectedMonthId) {
      setDayData(getDaySchedule(selectedDate, selectedMonthId));
      setWeekData(getWeekForDate(selectedDate, selectedMonthId));
    }
  }, [selectedDate, selectedMonthId]);

  const navigateDay = (direction: number) => {
    const currentIndex = availableDates.indexOf(selectedDate);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < availableDates.length) {
      setSelectedDate(availableDates[newIndex]);
    }
  };

  if (!dayData || !monthData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const currentIndex = availableDates.indexOf(selectedDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1;

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <MonthSelector
            months={availableMonths}
            selectedMonthId={selectedMonthId}
            onMonthChange={setSelectedMonthId}
          />
          <RecentUpdates />
        </div>
      </div>


      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-2 sm:p-3 border border-gray-200 shadow-sm gap-1 sm:gap-2">
        <button
          onClick={() => navigateDay(-1)}
          disabled={!hasPrev}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${hasPrev
            ? 'hover:bg-gray-100 text-gray-700'
            : 'text-gray-300 cursor-not-allowed'
            }`}
        >
          <span className="hidden sm:inline">← Prev</span>
          <span className="sm:hidden">←</span>
        </button>

        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-orange-50 border border-orange-200 rounded-lg px-2 sm:px-4 py-2 font-medium text-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm sm:text-base min-w-0 flex-1 max-w-[180px] sm:max-w-none"
        >
          {availableDates.map((date) => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>

        <button
          onClick={() => navigateDay(1)}
          disabled={!hasNext}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${hasNext
            ? 'hover:bg-gray-100 text-gray-700'
            : 'text-gray-300 cursor-not-allowed'
            }`}
        >
          <span className="hidden sm:inline">Next →</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>

      {/* AI Suggested Recap Toggle */}
      {dayData.aiSuggestedRecap && (
        <div className="mb-4">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`w-full group relative overflow-hidden rounded-xl p-[1px] transition-all duration-500 hover:shadow-md ${showAI ? 'shadow-purple-100' : 'shadow-gray-50'
              }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 animate-shimmer opacity-60`} style={{ backgroundSize: '200% 100%' }} />
            <div className="relative flex items-center justify-between gap-3 bg-white rounded-[11px] px-4 py-2 transition-colors group-hover:bg-white/95">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${showAI
                  ? 'bg-purple-100 rotate-12 shadow-inner shadow-purple-200'
                  : 'bg-gradient-to-tr from-purple-50 to-blue-50'
                  }`}>
                  <span className={showAI ? 'animate-pulse' : 'animate-slow-pulse'}> ✨ </span>
                </div>
                <div className="text-left">
                  <h3 className={`font-semibold text-sm tracking-normal ${showAI ? 'text-purple-900' : 'text-gray-700'
                    }`}>
                    Daily Recap Mission
                  </h3>
                  <p className="text-xs text-gray-400 font-medium opacity-80">
                    {showAI ? 'Mission Active' : 'Action-Oriented Learning'}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase transition-all duration-500 ${showAI
                ? 'bg-purple-50 border-purple-200 text-purple-600'
                : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}>
                <span>{showAI ? 'Hide' : 'Show'}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${showAI ? 'bg-purple-500 animate-pulse' : 'bg-gray-300'}`} />
              </div>
            </div>
          </button>

          {/* AI Content Section */}
          <div className={`grid transition-all duration-500 ease-in-out ${showAI ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
            }`}>
            <div className="overflow-hidden">
              <AISuggestedRecap content={dayData.aiSuggestedRecap} />
            </div>
          </div>
        </div>
      )}

      {/* Day Schedule */}
      <DaySchedule day={dayData} showHeader={false} />

      {/* Share Buttons */}
      <div className="mt-4 flex justify-end">
        <ShareButton day={dayData} />
      </div>


      {/* Important Dates */}
      {importantDates.length > 0 && (
        <div className="mt-6">
          <ImportantDates dates={importantDates} title="Upcoming Important Dates" />
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Link
          href={`/week?month=${selectedMonthId}`}
          className="bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">📆</div>
          <div className="font-semibold text-gray-800">View Full Week</div>
          <div className="text-sm text-gray-500">See all activities for the week</div>
        </Link>
        <Link
          href={`/rhymes?month=${selectedMonthId}`}
          className="bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">🎵</div>
          <div className="font-semibold text-gray-800">Rhymes & Shloka</div>
          <div className="text-sm text-gray-500">This month&apos;s songs and verses</div>
        </Link>
      </div>

      {/* About SchoolPuls Link */}
      <div className="mt-4">
        <Link
          href="/showcase.html"
          className="block w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg shadow-sm text-xl group-hover:scale-110 transition-transform">ℹ️</div>
            <div>
              <div className="font-semibold text-gray-800">About SchoolPuls</div>
              <div className="text-sm text-gray-500">View features and product showcase</div>
            </div>
            <div className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform">→</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

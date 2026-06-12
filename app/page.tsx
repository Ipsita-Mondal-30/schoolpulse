'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import MorningAlarm from '@/components/MorningAlarm';
import MonthSelector from '@/components/MonthSelector';
import ImportantDates from '@/components/ImportantDates';
import RecentUpdates from '@/components/RecentUpdates';
import {
  getMonthData,
  getMonthlyPlanner,
  getAvailableMonths,
  getCurrentMonthId,
  getImportantDates,
  MonthInfo,
  ImportantDate,
  PlannerSubject,
} from '@/lib/data';

function HomeContent() {
  const searchParams = useSearchParams();

  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [monthData, setMonthData] = useState<{ month: string; year: number; class: string } | null>(null);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [planner, setPlanner] = useState<PlannerSubject[]>([]);

  useEffect(() => {
    const months = getAvailableMonths();
    setAvailableMonths(months);
    setSelectedMonthId(getCurrentMonthId());
  }, []);

  useEffect(() => {
    if (!selectedMonthId) return;
    const data = getMonthData(selectedMonthId);
    setMonthData({ month: data.month, year: data.year, class: data.class });
    setImportantDates(getImportantDates(selectedMonthId));
    setPlanner(getMonthlyPlanner(selectedMonthId));
  }, [selectedMonthId]);

  if (!monthData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const upcomingDates = importantDates.filter(d => d.date >= new Date().toISOString().split('T')[0]).slice(0, 4);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">

      {/* ── Top Bar: Month Selector + Updates ── */}
      <div className="flex items-center justify-between mb-5">
        <MonthSelector
          months={availableMonths}
          selectedMonthId={selectedMonthId}
          onMonthChange={setSelectedMonthId}
        />
        <RecentUpdates />
      </div>

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 p-5 shadow-lg shadow-orange-200">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white" />
        </div>
        <div className="relative z-10">
          <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">BGS National Public School</p>
          <h1 className="text-white text-xl font-black leading-tight">
            Planner of the Month
          </h1>
          <p className="text-orange-100 font-semibold text-sm mt-0.5">
            {monthData.month} {monthData.year} · {monthData.class}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">
              {planner.length} Subjects
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">
              {planner.reduce((a, s) => a + s.portions.length, 0)} Portions
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">
              {planner.reduce((a, s) => a + s.activities.length, 0)} Activities
            </span>
          </div>
        </div>
      </div>
      
      {/* Morning Prep Digest Alarm Control */}
      <MorningAlarm />

      {/* ── Monthly Planner ── */}
      {planner.length > 0 ? (
        <MonthlyPlanner
          subjects={planner}
          month={monthData.month}
          year={monthData.year}
          className="mb-6"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center mb-6">
          <div className="text-5xl mb-3 opacity-40">📋</div>
          <p className="text-gray-500 font-medium">Monthly planner coming soon</p>
          <p className="text-xs text-gray-400 mt-1">Check back once the newsletter arrives</p>
        </div>
      )}

      {/* ── Upcoming Dates ── */}
      {upcomingDates.length > 0 && (
        <div className="mb-6">
          <ImportantDates dates={upcomingDates} title="Upcoming Dates" />
        </div>
      )}

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/homework"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📚</div>
          <div>
            <div className="font-bold text-sm text-gray-800">Homework</div>
            <div className="text-xs text-gray-400">Track assignments</div>
          </div>
        </Link>
        <Link
          href="/dates"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🏆</div>
          <div>
            <div className="font-bold text-sm text-gray-800">Events</div>
            <div className="text-xs text-gray-400">Competitions</div>
          </div>
        </Link>
        <Link
          href="/week"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📆</div>
          <div>
            <div className="font-bold text-sm text-gray-800">Weekly View</div>
            <div className="text-xs text-gray-400">Full schedule</div>
          </div>
        </Link>
        <Link
          href="/info"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">ℹ️</div>
          <div>
            <div className="font-bold text-sm text-gray-800">Info</div>
            <div className="text-xs text-gray-400">School details</div>
          </div>
        </Link>
      </div>

      {/* ── About Link ── */}
      <Link
        href="/showcase.html"
        className="flex items-center gap-3 w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all group"
      >
        <div className="bg-white p-2 rounded-xl shadow-sm text-xl group-hover:scale-110 transition-transform flex-shrink-0">ℹ️</div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-800">About SchoolPuls</div>
          <div className="text-xs text-gray-500">View features and product showcase</div>
        </div>
        <div className="text-gray-400 group-hover:translate-x-1 transition-transform">→</div>
      </Link>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import { SchoolEvent } from '@/app/actions';
import { ImportantDate } from '@/lib/data';

// ── helpers ──────────────────────────────────────────────────────────────────

const categoryIcon: Record<string, string> = {
  'music': '🎵',
  'scouts': '⚜️',
  'science': '🔬',
  'dance': '💃',
  'hindi': '🇮🇳',
  'brush': '🎨',
  'art': '🎨',
  'sport': '⚽',
  'default': '🏆',
};

function getEventIcon(topic: string): string {
  const t = topic.toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcon)) {
    if (t.includes(key)) return icon;
  }
  return categoryIcon.default;
}

const gradients = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
];

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: SchoolEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const gradient = gradients[index % gradients.length];
  const icon = getEventIcon(event.topic);
  const hasFees = event.fees && event.fees !== '-' && event.fees !== '';
  const hasLink = event.registrationMode?.startsWith('http');

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top accent bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl flex-shrink-0 shadow-md`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{event.topic}</h3>
            {event.toDo && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{event.toDo}</p>
            )}
          </div>
          <span className={`text-gray-400 transition-transform duration-200 mt-1 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>

        {/* Key info pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {event.registrationDeadline && event.registrationDeadline !== '-' && (
            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span>📋</span> Register by {event.registrationDeadline}
            </span>
          )}
          {event.competitionDate && event.competitionDate !== '-' && (
            <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span>📅</span> {event.competitionDate}
            </span>
          )}
          {hasFees ? (
            <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span>💰</span> ₹{event.fees}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full">
              Free
            </span>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Activity</p>
                <p className="text-gray-700 font-medium">{event.toDo || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Competition Date</p>
                <p className="text-gray-700 font-medium">{event.competitionDate || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Reg. Deadline</p>
                <p className="text-gray-700 font-medium">{event.registrationDeadline || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Fees</p>
                <p className="text-gray-700 font-medium">{hasFees ? `₹${event.fees}` : 'Free'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">How to Register</p>
              {hasLink ? (
                <a
                  href={event.registrationMode}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className={`inline-flex items-center gap-2 bg-gradient-to-r ${gradient} text-white text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm`}
                >
                  Register Online →
                </a>
              ) : (
                <p className="text-gray-700 text-sm">{event.registrationMode}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Holiday Row ───────────────────────────────────────────────────────────────

function HolidayRow({ item, today }: { item: ImportantDate; today: string }) {
  const isPast = item.date < today;
  const isToday = item.date === today;

  const [y, m, d] = item.date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayNum = dateObj.getDate();
  const monthAbbr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
  const weekday = dateObj.toLocaleString('default', { weekday: 'short' });

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isToday
        ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-300'
        : isPast
        ? 'bg-gray-50 border-gray-100 opacity-50'
        : 'bg-white border-gray-100 hover:border-red-200 hover:shadow-sm'
    }`}>
      <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 shadow-sm ${
        isToday ? 'bg-orange-500 text-white' : isPast ? 'bg-gray-300 text-white' : 'bg-red-500 text-white'
      }`}>
        <span className="text-[8px] font-bold leading-none">{monthAbbr}</span>
        <span className="text-sm font-black leading-none mt-0.5">{dayNum}</span>
        <span className="text-[8px] leading-none opacity-80">{weekday}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 leading-tight">{item.event}</span>
          {isToday && (
            <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">TODAY</span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
        )}
      </div>

      <span className="text-lg flex-shrink-0">{isPast ? '✅' : '🎉'}</span>
    </div>
  );
}

// ── Main Client View ──────────────────────────────────────────────────────────

interface EventsViewProps {
  events: SchoolEvent[];
  holidays: ImportantDate[];
  today: string;
}

export default function EventsView({ events, holidays, today }: EventsViewProps) {
  const [showPastHolidays, setShowPastHolidays] = useState(false);

  const upcomingHolidays = holidays.filter(h => h.date >= today);
  const pastHolidays = holidays.filter(h => h.date < today);
  const displayedHolidays = showPastHolidays ? holidays : upcomingHolidays;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">

      {/* ── School Events ── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg shadow-md">🏆</div>
          <div>
            <h2 className="text-xl font-black text-gray-900">School Events</h2>
            <p className="text-xs text-gray-400 font-medium">Competitions &amp; activities open for participation</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <div className="text-5xl mb-3 opacity-40">🏆</div>
            <p className="text-gray-500 font-medium">No events listed yet</p>
            <p className="text-xs text-gray-400 mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {events.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── School Holidays ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-lg shadow-md">🎉</div>
            <div>
              <h2 className="text-xl font-black text-gray-900">School Holidays</h2>
              <p className="text-xs text-gray-400 font-medium">{upcomingHolidays.length} upcoming holidays</p>
            </div>
          </div>
          {pastHolidays.length > 0 && (
            <button
              onClick={() => setShowPastHolidays(!showPastHolidays)}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              {showPastHolidays ? 'Hide past' : `+${pastHolidays.length} past`}
            </button>
          )}
        </div>

        {displayedHolidays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <div className="text-5xl mb-3 opacity-40">🎉</div>
            <p className="text-gray-500 font-medium">No upcoming holidays</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedHolidays.map((h, i) => (
              <HolidayRow key={i} item={h} today={today} />
            ))}
          </div>
        )}

        <div className="mt-5 bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> All holiday dates are tentative and subject to change. Please confirm with the school for any updates.
          </p>
        </div>
      </div>
    </div>
  );
}

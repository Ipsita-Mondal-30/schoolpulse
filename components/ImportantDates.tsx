'use client';

import { ImportantDate, formatShortDate } from '@/lib/data';

interface ImportantDatesProps {
  dates: ImportantDate[];
  title?: string;
  showAll?: boolean;
}

export default function ImportantDates({ dates, title = "Important Dates", showAll = false }: ImportantDatesProps) {
  if (!dates || dates.length === 0) return null;

  const today = new Date().toISOString().split('T')[0];

  // Filter to show only upcoming dates unless showAll is true
  const displayDates = showAll
    ? dates
    : dates.filter(d => d.date >= today).slice(0, 5);

  if (displayDates.length === 0) return null;

  const typeStyles: Record<string, { bg: string; textColor: string; border: string }> = {
    holiday: { bg: 'bg-red-500', textColor: 'text-white', border: 'border-red-200' },
    event: { bg: 'bg-blue-500', textColor: 'text-white', border: 'border-blue-200' },
    activity: { bg: 'bg-green-500', textColor: 'text-white', border: 'border-green-200' },
  };

  const isToday = (date: string) => date === today;
  const isPast = (date: string) => date < today;

  // Extract day number from date string (YYYY-MM-DD)
  const getDayNumber = (dateStr: string) => {
    return parseInt(dateStr.split('-')[2], 10);
  };

  // Get month abbreviation
  const getMonthAbbr = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  };

  // Get weekday name
  const getWeekday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
      <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-sans">
        <span>📌</span> {title}
      </h3>
      <div className="space-y-1.5">
        {displayDates.map((item, index) => {
          const style = typeStyles[item.type] || typeStyles.event;
          const todayHighlight = isToday(item.date);
          const past = isPast(item.date);
          const dayNum = getDayNumber(item.date);
          const monthAbbr = getMonthAbbr(item.date);
          const weekday = getWeekday(item.date);

          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${todayHighlight ? 'ring-1 ring-orange-300 bg-orange-50/50 border-orange-200 shadow-sm' : 'bg-gray-50/30 border-gray-100 hover:bg-white hover:shadow-sm'
                } ${past ? 'opacity-40' : ''}`}
            >
              {/* Compact Date Badge */}
              <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${style.bg} ${style.textColor} flex-shrink-0 shadow-sm`}>
                <div className="text-[8px] font-bold leading-none uppercase">{monthAbbr}</div>
                <div className="text-sm font-black leading-none mt-0.5">{dayNum}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-bold text-xs text-gray-800">{item.event}</span>
                  {todayHighlight && (
                    <span className="text-[8px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                      TODAY
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 leading-tight">
                  <span className="font-bold text-gray-600">{weekday}</span>
                  <span className="mx-1 opacity-50">•</span>
                  {item.description}
                </div>
              </div>
              <div className="text-[9px] font-bold text-gray-400 whitespace-nowrap hidden sm:block">
                {formatShortDate(item.date)}
              </div>
            </div>
          );
        })}
      </div>
      {
        !showAll && dates.filter(d => d.date >= today).length > 5 && (
          <div className="text-[9px] text-gray-400 mt-3 text-center font-bold uppercase tracking-tighter">
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              + {dates.filter(d => d.date >= today).length - 5} More • View All
            </span>
          </div>
        )
      }
    </div >
  );
}

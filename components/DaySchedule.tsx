"use client";

import {
  DaySchedule as DayScheduleType,
  getSubjectColor,
  formatDate,
} from "@/lib/data";
import WeekendRevision from "./WeekendRevision";

interface DayScheduleProps {
  day: DayScheduleType & { newsletterPending?: boolean };
  showHeader?: boolean;
  compact?: boolean;
}

export default function DaySchedule({
  day,
  showHeader = true,
  compact = false,
}: DayScheduleProps) {
  // Weekend Revision takes priority
  if (day.isWeekendRevision && day.weekendRevisionContent) {
    return (
      <div>
        {showHeader && (
          <h2
            className={`${compact ? "text-base" : "text-lg"} font-semibold text-gray-800 mb-4`}
          >
            {formatDate(day.date)}
          </h2>
        )}
        <WeekendRevision content={day.weekendRevisionContent} date={day.date} />
      </div>
    );
  }

  if (day.isHoliday) {
    const holidayName = day.holidayName || "Holiday";
    const isAcademicYearCompleted = holidayName.includes(
      "Academic year completed",
    );

    return (
      <div
        className={`${compact ? "p-3" : "p-6"} bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200`}
      >
        {showHeader && (
          <h2 className="text-lg font-semibold text-orange-800 mb-2">
            {formatDate(day.date)}
          </h2>
        )}
        <div className="flex items-center gap-3">
          <span className="text-3xl">
            {isAcademicYearCompleted ? "🎓" : "🎉"}
          </span>
          <div>
            <p
              className={`${compact ? "text-base" : "text-xl"} font-bold text-orange-700`}
            >
              {day.holidayName}
            </p>
            {isAcademicYearCompleted ? (
              <div className="mt-2">
                <a
                  href="/dates"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-semibold hover:bg-orange-600 transition-colors shadow-sm"
                >
                  <span>📅</span> View Important Dates
                </a>
              </div>
            ) : (
              <p className="text-orange-600">School Holiday</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Newsletter not yet received — show a friendly pending state
  if (day.newsletterPending || day.schedule.length === 0) {
    return (
      <div
        className={`${compact ? "p-4" : "p-6"} bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200`}
      >
        {showHeader && (
          <h2
            className={`${compact ? "text-base" : "text-lg"} font-semibold text-amber-800 mb-4`}
          >
            {formatDate(day.date)}
          </h2>
        )}
        <div className="flex items-center gap-4">
          <span className="text-4xl">📬</span>
          <div>
            <p className="font-bold text-amber-800 text-sm">
              Newsletter on its way!
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              March timetable will be updated once the newsletter arrives from
              school.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${compact ? "p-3" : "p-6"} bg-white rounded-xl border border-gray-200 shadow-sm`}
    >
      {showHeader && (
        <h2
          className={`${compact ? "text-base" : "text-lg"} font-semibold text-gray-800 mb-4`}
        >
          {formatDate(day.date)}
        </h2>
      )}
      <div className="space-y-2">
        {day.schedule.map((item, index) => (
          <div
            key={index}
            className={`flex ${compact ? "gap-2 p-2" : "gap-4 p-3"} rounded-lg border ${getSubjectColor(item.subject)}`}
          >
            <div
              className={`${compact ? "text-xs w-16" : "text-sm w-24"} font-medium shrink-0`}
            >
              {item.time}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`font-semibold ${compact ? "text-xs" : "text-sm"} break-words`}
              >
                {item.subject}
              </div>
              {item.activity && (
                <div
                  className={`${compact ? "text-xs" : "text-sm"} opacity-80 break-words`}
                >
                  {item.activity}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import jolData from "@/data/info/joy-of-learning.json";

const getSubjectIcon = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes("math")) return "🔢";
  if (s.includes("english")) return "📖";
  if (s.includes("evs") || s.includes("environment")) return "🌿";
  if (s.includes("hindi")) return "🪷";
  if (s.includes("kannada")) return "🏛️";
  if (s.includes("computer")) return "💻";
  return "📝";
};

export default function JoyOfLearningPage() {
  const today = new Date().toISOString().split("T")[0];

  const nextExamDate = jolData.timetable.schedule.find(
    (row) => row.date >= today
  );

  const daysUntilExam = nextExamDate
    ? Math.ceil(
        (new Date(nextExamDate.date + "T00:00:00").getTime() -
          new Date(today + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>🎓</span> Joy of Learning - I
        </h2>
        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded-full border border-indigo-200">
          {jolData.year}
        </span>
      </div>

      {/* Countdown Banner */}
      {nextExamDate && daysUntilExam !== null && (
        <div
          className={`rounded-2xl px-4 py-3 mb-5 border ${
            daysUntilExam === 0
              ? "bg-red-50 border-red-200 text-red-800"
              : daysUntilExam <= 3
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-indigo-50 border-indigo-200 text-indigo-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {daysUntilExam === 0 ? "🔴" : daysUntilExam <= 3 ? "⏰" : "📅"}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                  {daysUntilExam === 0
                    ? "Today's Exam"
                    : `Next Exam in ${daysUntilExam} day${daysUntilExam === 1 ? "" : "s"}`}
                </p>
                <p className="text-sm font-extrabold">
                  {nextExamDate.day}, {new Date(nextExamDate.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} — {nextExamDate.classI}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timetable */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm mb-6">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-150">
          <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
            📅 Exam Timetable
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            {jolData.timetable.classes} — July 20-25, 2026
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-50/50">
                <th className="text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Date
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Class I
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Class II
                </th>
              </tr>
            </thead>
            <tbody>
              {jolData.timetable.schedule.map((row) => {
                const isToday = row.date === today;
                const isPast = row.date < today;
                return (
                  <tr
                    key={row.date}
                    className={
                      isToday
                        ? "bg-amber-50 ring-2 ring-amber-300 ring-inset"
                        : isPast
                        ? "bg-gray-50/50 opacity-60"
                        : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div
                        className={`font-bold text-sm ${
                          isToday ? "text-amber-800" : "text-gray-800"
                        }`}
                      >
                        {row.day}
                        {isToday && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[8px] font-black rounded-full">
                            TODAY
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 border-b border-gray-100 font-bold ${
                        isToday ? "text-amber-800" : "text-gray-800"
                      }`}
                    >
                      <span className="mr-1.5">{getSubjectIcon(row.classI)}</span>
                      {row.classI}
                      {isPast && " ✓"}
                    </td>
                    <td
                      className={`px-4 py-3 border-b border-gray-100 font-medium ${
                        isToday ? "text-amber-800" : "text-gray-600"
                      }`}
                    >
                      {row.classII}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portions / Syllabus */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-150">
          <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
            📖 Syllabus / Portions
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            What to study for each subject
          </p>
        </div>
        <div className="p-4 space-y-4">
          {jolData.portions.subjects.map((subj) => (
            <div
              key={subj.slNo}
              className="bg-gray-50/80 rounded-2xl border border-gray-100 p-4"
            >
              <h4 className="font-extrabold text-gray-900 text-sm md:text-base flex items-center gap-2 mb-2">
                <span className="text-base">{getSubjectIcon(subj.subject)}</span>
                {subj.subject}
              </h4>
              <ul className="space-y-1">
                {subj.portions.map((item, i) => {
                  const isIndented = item.startsWith("  ");
                  return (
                    <li
                      key={i}
                      className={`text-sm text-gray-700 leading-relaxed ${
                        isIndented ? "pl-5 text-gray-600" : ""
                      }`}
                    >
                      {isIndented ? (
                        <span className="text-gray-400 mr-1">›</span>
                      ) : (
                        ""
                      )}
                      {item.trim()}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

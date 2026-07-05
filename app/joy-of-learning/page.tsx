"use client";

import { useState } from "react";
import jolData from "@/data/info/joy-of-learning.json";
import studyGuide from "@/data/info/jol-study-guide.json";

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

function StudyGuideCard({
  subj,
  today,
}: {
  subj: (typeof studyGuide.subjects)[number];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const isPast = subj.examDate < today;
  const isToday = subj.examDate === today;
  const daysLeft = Math.ceil(
    (new Date(subj.examDate + "T00:00:00").getTime() -
      new Date(today + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const examLabel = new Date(subj.examDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric" }
  );

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        open
          ? "border-indigo-200 shadow-md bg-white"
          : "border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm"
      } ${isPast ? "opacity-60" : ""}`}
    >
      {/* Accordion Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
            open ? "bg-indigo-100" : "bg-gray-50"
          }`}
        >
          {getSubjectIcon(subj.subject)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
            {subj.subject}
            {isToday && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-black rounded-full animate-pulse">
                EXAM TODAY
              </span>
            )}
            {isPast && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[8px] font-black rounded-full">
                DONE ✓
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 font-medium mt-0.5">
            📅 {examLabel}
            {!isPast && !isToday && daysLeft > 0 && (
              <span className="ml-1.5 text-indigo-500 font-bold">
                · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-gray-400 transition-transform duration-200 text-sm flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* Accordion Body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Parent Tips */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">
              💡 How you can help
            </p>
            <ul className="space-y-1.5">
              {subj.parentTips.map((tip, i) => (
                <li
                  key={i}
                  className="text-xs text-amber-900 leading-relaxed flex gap-1.5"
                >
                  <span className="text-amber-400 flex-shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Topics */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 px-0.5">
              📚 Topic-by-topic guide
            </p>
            <div className="space-y-2.5">
              {subj.topics.map((topic, i) => (
                <div
                  key={i}
                  className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5"
                >
                  <p className="font-bold text-gray-800 text-[13px] mb-1.5">
                    {i + 1}. {topic.name}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <span className="font-bold text-indigo-600">
                      What to know:{" "}
                    </span>
                    {topic.whatToKnow}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
                    <span className="font-bold text-emerald-600">
                      Practice at home:{" "}
                    </span>
                    {topic.practiceAtHome}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Quiz */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                ✏️ Quick practice quiz
              </p>
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                  showAnswers
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-indigo-600 border border-indigo-200"
                }`}
              >
                {showAnswers ? "Hide answers" : "Show answers"}
              </button>
            </div>
            <ol className="space-y-2">
              {subj.quiz.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  <span className="font-bold text-gray-800">
                    {i + 1}. {item.q}
                  </span>
                  {showAnswers && (
                    <span className="block mt-0.5 pl-4 text-emerald-700 font-semibold">
                      ✓ {item.a}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="text-[10px] text-indigo-400 mt-2.5 italic">
              Ask these orally — no writing needed. Praise every attempt! 🌟
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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

      {/* Parent Study & Practice Guide */}
      <div className="mt-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 p-5 mb-4 shadow-lg shadow-indigo-200">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-white" />
            <div className="absolute bottom-0 left-6 w-16 h-16 rounded-full bg-white" />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1">
              👨‍👩‍👦 For Parents
            </p>
            <h3 className="text-white text-lg font-black leading-tight">
              Study &amp; Practice Guide
            </h3>
            <p className="text-indigo-100 text-xs font-medium mt-1 leading-relaxed">
              Tap a subject for topic-wise guidance, home practice ideas and a
              quick quiz — arranged in exam order.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {studyGuide.subjects.map((subj) => (
            <StudyGuideCard key={subj.subject} subj={subj} today={today} />
          ))}
        </div>
      </div>
    </div>
  );
}

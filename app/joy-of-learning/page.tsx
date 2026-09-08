"use client";

import { useState } from "react";
import jolData from "@/data/info/joy-of-learning.json";
import studyGuide from "@/data/info/jol-study-guide.json";
import RevisionGames from "@/components/RevisionGames";
import { getMonthData } from "@/lib/data";

function formatJoLWindowLabel(): string {
  const jol = getMonthData().joyOfLearning;
  const startRaw = jol?.begins ?? jol?.startDate;
  const endRaw = jol?.ends ?? jol?.endDate;
  if (startRaw && endRaw) {
    const start = new Date(startRaw + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const end = new Date(endRaw + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const title = jol?.title ?? "Joy of Learning";
    return `${title} · ${start} – ${end}`;
  }
  return "July 20-25, 2026";
}

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

// Map a timetable subject name to its study-resources Drive folder URL
const getResourceUrl = (subject: string): string | undefined => {
  const s = subject.toLowerCase();
  const match = studyGuide.subjects.find((sub) => {
    const g = sub.subject.toLowerCase();
    if (s.includes("evs") || s.includes("environment"))
      return g.includes("environment");
    if (s.includes("math")) return g.includes("math");
    if (s.includes("computer")) return g.includes("computer");
    return g.includes(s) || s.includes(g);
  });
  return match?.resourcesUrl;
};

// Days left until an exam date, relative to today
const getDaysLeft = (date: string, today: string): number =>
  Math.ceil(
    (new Date(date + "T00:00:00").getTime() -
      new Date(today + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );

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
          {/* Study Resources Link */}
          {subj.resourcesUrl && (
            <a
              href={subj.resourcesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5 hover:bg-blue-100 hover:border-blue-300 transition-colors group"
            >
              <span className="text-2xl">📂</span>
              <div className="flex-1">
                <p className="text-xs font-black text-blue-800">
                  {subj.subject} Study Resources
                </p>
                <p className="text-[11px] text-blue-500 font-medium">
                  Notes, worksheets &amp; practice material on Google Drive
                </p>
              </div>
              <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </a>
          )}

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
        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
              📅 Exam Timetable
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Class I — {formatJoLWindowLabel()}
            </p>
          </div>
          <a
            href={studyGuide.trackerFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
          >
            ✅ Tracker
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-50/50">
                <th className="text-left px-3 sm:px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Date
                </th>
                <th className="text-left px-3 sm:px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Subject
                </th>
                <th className="text-center px-2 sm:px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Days Left
                </th>
                <th className="text-center px-2 sm:px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-indigo-700 border-b border-indigo-100">
                  Study
                </th>
              </tr>
            </thead>
            <tbody>
              {jolData.timetable.schedule.map((row) => {
                const isToday = row.date === today;
                const isPast = row.date < today;
                const daysLeft = getDaysLeft(row.date, today);
                const resourceUrl = getResourceUrl(row.classI);
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
                    <td className="px-3 sm:px-4 py-3 border-b border-gray-100">
                      <div
                        className={`font-bold text-sm ${
                          isToday ? "text-amber-800" : "text-gray-800"
                        }`}
                      >
                        {row.day}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-3 sm:px-4 py-3 border-b border-gray-100 font-bold ${
                        isToday ? "text-amber-800" : "text-gray-800"
                      }`}
                    >
                      <span className="mr-1.5">{getSubjectIcon(row.classI)}</span>
                      {row.classI}
                    </td>
                    <td className="px-2 sm:px-4 py-3 border-b border-gray-100 text-center">
                      {isPast ? (
                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full">
                          Done ✓
                        </span>
                      ) : isToday ? (
                        <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-full animate-pulse">
                          Today
                        </span>
                      ) : (
                        <span className="inline-flex flex-col items-center leading-none">
                          <span className="text-base font-black text-indigo-600">
                            {daysLeft}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase">
                            {daysLeft === 1 ? "day" : "days"}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 border-b border-gray-100 text-center">
                      {resourceUrl ? (
                        <a
                          href={resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-base hover:bg-blue-100 hover:border-blue-300 transition-colors"
                          title={`${row.classI} study resources`}
                        >
                          📂
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50/60 border-t border-gray-100">
          <a
            href={studyGuide.resourcesFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            📂 Open All Study Resources
          </a>
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
            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href={studyGuide.resourcesFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
              >
                📂 All Resources
              </a>
              <a
                href={studyGuide.trackerFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
              >
                ✅ Progress Tracker
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {studyGuide.subjects.map((subj) => (
            <StudyGuideCard key={subj.subject} subj={subj} today={today} />
          ))}
        </div>
      </div>

      {/* Revision Games (gamified revision papers) */}
      <RevisionGames />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { fetchHomework, Homework } from "../actions";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import HomeworkShareButton from "@/components/HomeworkShareButton";

export default function HomeworkPage() {
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHomework();
      setHomeworkList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group by assigned date
  const groupedHomework = homeworkList.reduce((acc, hw) => {
    // Determine assigned date. If it starts with "Assigned: ", extract the date part
    let dateStr = hw.createdAt || "Unknown Date";
    if (hw.notes && hw.notes.startsWith("Assigned: ")) {
      dateStr = hw.notes.replace("Assigned: ", "").trim();
    }
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(hw);
    return acc;
  }, {} as Record<string, Homework[]>);

  // Parse and sort dates descending
  const sortedDates = Object.keys(groupedHomework).sort((a, b) => {
    if (a === "Unknown Date") return 1;
    if (b === "Unknown Date") return -1;
    // Format YYYY-MM-DD or DD-MMM-YYYY
    const parseDate = (dStr: string) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        // Check if year is first (YYYY-MM-DD) or last (DD-MMM-YYYY)
        if (parts[0].length === 4) {
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else {
          // e.g. 12-Jun-2026 or 12-06-2026
          const day = Number(parts[0]);
          const year = Number(parts[2]);
          const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          const mStr = parts[1].toLowerCase().substring(0, 3);
          const month = monthMap[mStr] !== undefined ? monthMap[mStr] : Number(parts[1]) - 1;
          return new Date(year, month, day).getTime();
        }
      }
      return new Date(dStr).getTime() || 0;
    };
    return parseDate(b) - parseDate(a);
  });

  const getSubjectColor = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math") || s.includes("numeracy"))
      return "bg-blue-50 text-blue-700 border-blue-150";
    if (s.includes("english") || s.includes("literacy"))
      return "bg-emerald-50 text-emerald-700 border-emerald-150";
    if (s.includes("kannada"))
      return "bg-yellow-50 text-yellow-700 border-yellow-150";
    if (s.includes("evs") || s.includes("science"))
      return "bg-green-50 text-green-700 border-green-150";
    if (s.includes("art") || s.includes("craft"))
      return "bg-pink-50 text-pink-700 border-pink-150";
    if (s.includes("hindi"))
      return "bg-orange-50 text-orange-700 border-orange-150";
    return "bg-indigo-50 text-indigo-700 border-indigo-150";
  };

  const getSubjectBorderColor = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math") || s.includes("numeracy")) return "border-blue-500";
    if (s.includes("english") || s.includes("literacy")) return "border-emerald-500";
    if (s.includes("kannada")) return "border-yellow-500";
    if (s.includes("evs") || s.includes("science")) return "border-green-500";
    if (s.includes("art") || s.includes("craft")) return "border-pink-500";
    if (s.includes("hindi")) return "border-orange-500";
    return "border-indigo-500";
  };

  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math")) return "🔢";
    if (s.includes("english")) return "📖";
    if (s.includes("evs") || s.includes("science")) return "🌿";
    if (s.includes("hindi")) return "🪷";
    if (s.includes("kannada")) return "🏛️";
    return "📝";
  };

  // State to track collapsed/expanded dates. Default first one expanded, others collapsed
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sortedDates.length > 0) {
      // Show first 3 dates (or all if less than 3) by default, others collapsed
      const initial: Record<string, boolean> = {};
      sortedDates.forEach((date, index) => {
        initial[date] = index < 3;
      });
      setExpandedDates(initial);
    }
  }, [homeworkList]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === "Unknown Date") return dateStr;
    try {
      const parts = dateStr.split("-");
      let dateObj: Date;
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          const day = Number(parts[0]);
          const year = Number(parts[2]);
          const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          const mStr = parts[1].toLowerCase().substring(0, 3);
          const month = monthMap[mStr] !== undefined ? monthMap[mStr] : Number(parts[1]) - 1;
          dateObj = new Date(year, month, day);
        }
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        // Normalize
        today.setHours(0,0,0,0);
        yesterday.setHours(0,0,0,0);
        dateObj.setHours(0,0,0,0);

        if (dateObj.getTime() === today.getTime()) {
          return "Today (June 12, 2026)";
        }
        if (dateObj.getTime() === yesterday.getTime()) {
          return "Yesterday (June 11, 2026)";
        }
        return dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-15 transform translate-x-4 translate-y-4">
          <span className="text-9xl">📚</span>
        </div>
        <div className="relative z-10">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wider uppercase">
            Class Diary
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight">
            Homework Tracker
          </h1>
          <p className="text-white/85 text-sm md:text-base mt-2 max-w-xl">
            Keep track of daily subject assignments, submission deadlines, and preparation steps.
          </p>
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="text-xs md:text-sm font-medium">
                {homeworkList.length} Total Assignments
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 flex items-center gap-2">
              <span className="text-lg">📅</span>
              <span className="text-xs md:text-sm font-medium">
                {sortedDates.length} Days Tracked
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>📅</span> Timeline
        </h2>
        <div className="flex items-center gap-3">
          <HomeworkShareButton homeworkList={homeworkList} />
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-orange-500 transition-all rounded-xl hover:bg-orange-50 border border-gray-200 bg-white shadow-sm flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh Data"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-500 animate-pulse text-sm">
            Fetching active homework planner...
          </p>
        </div>
      ) : homeworkList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
          <div className="text-6xl mb-4 opacity-50">📝</div>
          <p className="text-xl text-gray-500 font-bold">
            No homework assignments found.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Check back later for updates or sync with neverskip.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date, index) => {
            const isExpanded = expandedDates[date];
            const list = groupedHomework[date];

            return (
              <div key={date} className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                {/* Accordion Date Header */}
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-150 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">
                        {formatDateLabel(date)}
                      </h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {list.length} {list.length === 1 ? "assignment" : "assignments"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {/* Assignments List */}
                {isExpanded && (
                  <div className="p-6 space-y-5 bg-white divide-y divide-gray-100">
                    {list.map((hw, idx) => (
                      <div
                        key={hw.id}
                        className={`pt-4 first:pt-0 flex flex-col gap-3 relative`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getSubjectIcon(hw.subject)}</span>
                            <span className="font-extrabold text-gray-900 text-sm md:text-base tracking-tight">
                              {hw.subject}
                            </span>
                          </div>
                          {hw.submissionDate && (
                            <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100 flex items-center gap-1">
                              ⏰ Submit by: {hw.submissionDate}
                            </span>
                          )}
                        </div>

                        <div className="text-gray-700 leading-relaxed text-sm md:text-base bg-gray-50/50 rounded-2xl p-4 border border-gray-100/80">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                            {hw.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

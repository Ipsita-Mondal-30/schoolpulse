"use client";

import { useState, useEffect } from "react";
import { fetchHomework, Homework } from "../actions";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import HomeworkShareButton from "@/components/HomeworkShareButton";

export default function HomeworkPage() {
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    // Check local storage cache first if not forcing refresh
    if (!forceRefresh && typeof window !== "undefined") {
      const cached = localStorage.getItem("homework_cache_data");
      const cachedTime = localStorage.getItem("homework_cache_time");
      if (cached && cachedTime) {
        const age = Date.now() - Number(cachedTime);
        if (age < 15 * 60 * 1000) { // 15 minutes
          setHomeworkList(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const data = await fetchHomework();
      setHomeworkList(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("homework_cache_data", JSON.stringify(data));
        localStorage.setItem("homework_cache_time", String(Date.now()));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Helper to safely unpack notes structure
  const getHwMeta = (hw: Homework) => {
    try {
      if (hw.notes && (hw.notes.startsWith("{") || hw.notes.startsWith("["))) {
        const parsed = JSON.parse(hw.notes);
        return {
          assigned: parsed.assigned || hw.createdAt || "Unknown Date",
          chapter: parsed.chapter || ""
        };
      }
    } catch (e) {}
    
    // Fallback if not stringified JSON
    let assigned = hw.createdAt || "Unknown Date";
    if (hw.notes && hw.notes.startsWith("Assigned: ")) {
      assigned = hw.notes.replace("Assigned: ", "").trim();
    }
    return { assigned, chapter: "" };
  };

  // Group by assigned date
  const groupedHomework = homeworkList.reduce((acc, hw) => {
    const { assigned } = getHwMeta(hw);
    if (!acc[assigned]) {
      acc[assigned] = [];
    }
    acc[assigned].push(hw);
    return acc;
  }, {} as Record<string, Homework[]>);

  // Parse and sort dates descending
  const sortedDates = Object.keys(groupedHomework).sort((a, b) => {
    if (a === "Unknown Date") return 1;
    if (b === "Unknown Date") return -1;
    
    const parseDate = (dStr: string) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else {
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
    if (s.includes("math")) return "bg-blue-50 text-blue-700 border-blue-100";
    if (s.includes("english")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s.includes("kannada")) return "bg-yellow-50 text-yellow-700 border-yellow-100";
    if (s.includes("evs") || s.includes("science")) return "bg-green-50 text-green-700 border-green-100";
    if (s.includes("art") || s.includes("craft")) return "bg-pink-50 text-pink-700 border-pink-100";
    if (s.includes("hindi")) return "bg-orange-50 text-orange-700 border-orange-100";
    return "bg-indigo-50 text-indigo-700 border-indigo-100";
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

  // State to track collapsed/expanded dates
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sortedDates.length > 0) {
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

        today.setHours(0,0,0,0);
        yesterday.setHours(0,0,0,0);
        dateObj.setHours(0,0,0,0);

        if (dateObj.getTime() === today.getTime()) {
          return "Today (June 12)";
        }
        if (dateObj.getTime() === yesterday.getTime()) {
          return "Yesterday (June 11)";
        }
        // Exclude year from return string
        return dateObj.toLocaleDateString("en-US", {
          weekday: "long",
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>📅</span> Timeline
        </h2>
        <div className="flex items-center gap-3">
          <HomeworkShareButton homeworkList={homeworkList} />
          <button
            onClick={() => loadData(true)}
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
                    <span className="text-xl flex">
                      {(() => {
                        // Extract only day part. E.g. "12" from "12-Jun-2026" or "2026-06-12"
                        let dayVal = "";
                        const parts = date.split("-");
                        if (parts.length === 3) {
                          if (parts[0].length === 4) {
                            dayVal = parts[2]; // YYYY-MM-DD
                          } else {
                            dayVal = parts[0]; // DD-MMM-YYYY or DD-MM-YYYY
                          }
                        }
                        const finalDay = dayVal || "12";
                        const digitMap: Record<string, string> = {
                          "0": "0️⃣", "1": "1️⃣", "2": "2️⃣", "3": "3️⃣", "4": "4️⃣",
                          "5": "5️⃣", "6": "6️⃣", "7": "7️⃣", "8": "8️⃣", "9": "9️⃣"
                        };
                        return finalDay.split("").map(char => digitMap[char] || char).join("");
                      })()}
                    </span>
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
                  <div className="p-6 space-y-6 bg-white divide-y divide-gray-100">
                    {list.map((hw, idx) => {
                      const { chapter } = getHwMeta(hw);
                      return (
                        <div
                          key={hw.id}
                          className="pt-5 first:pt-0 flex flex-col gap-2 relative"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              {/* Chapter Heading */}
                              {chapter && (
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  {chapter}
                                </h4>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-base">{getSubjectIcon(hw.subject)}</span>
                                <span className="font-extrabold text-gray-900 text-sm md:text-base tracking-tight">
                                  {hw.subject}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border rounded-md bg-gray-100 text-gray-600 border-gray-200">
                                  I-A
                                </span>
                              </div>
                            </div>
                            {hw.submissionDate && (
                              <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100 flex items-center gap-1">
                                ⏰ Submit by: {hw.submissionDate}
                              </span>
                            )}
                          </div>

                          <div className="text-gray-700 leading-relaxed text-sm md:text-base bg-gray-50/50 rounded-2xl p-4 border border-gray-100/80 mt-1 whitespace-pre-line">
                            {hw.content}
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
      )}
    </div>
  );
}

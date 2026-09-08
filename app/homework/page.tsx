"use client";

import { useState, useEffect } from "react";
import {
  filterHomeworkBySection,
  sortHomeworkDatesNewestFirst,
  type UiHomeworkItem,
} from "@/lib/ui-merge";
import { useHomeworkQuery } from "@/lib/queries/homework";

const DEFAULT_SECTION = "I-A";
const ALL_SECTIONS = ["I-A", "I-B", "I-C", "I-D", "I-E", "I-F", "I-G", "I-H", "I-I", "I-J", "I-K"];
const PINNED_SECTION_KEY = "schoolpulse_pinned_section";

type HomeworkItem = UiHomeworkItem;

export default function HomeworkPage() {
  const { data, isPending, isError, error } = useHomeworkQuery();
  const [selectedSection, setSelectedSection] = useState<string>(DEFAULT_SECTION);
  const [pinnedSection, setPinnedSection] = useState<string>(DEFAULT_SECTION);
  const allHomework = data?.items ?? [];
  const fromSheet = data?.fromSheet ?? false;
  const loading = isPending;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(PINNED_SECTION_KEY);
      if (saved && ALL_SECTIONS.includes(saved)) {
        setPinnedSection(saved);
        setSelectedSection(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (isError) {
      console.error("Failed to fetch homework sources", error);
    }
  }, [isError, error]);

  const handlePinSection = (sec: string) => {
    setPinnedSection(sec);
    if (typeof window !== "undefined") {
      localStorage.setItem(PINNED_SECTION_KEY, sec);
    }
  };

  const filteredList = filterHomeworkBySection(allHomework, selectedSection);

  const groupedByDate = filteredList.reduce((acc, hw) => {
    if (!acc[hw.sentDate]) acc[hw.sentDate] = [];
    acc[hw.sentDate].push(hw);
    return acc;
  }, {} as Record<string, HomeworkItem[]>);

  const sortedDates = sortHomeworkDatesNewestFirst(Object.keys(groupedByDate));

  const sectionCounts = ALL_SECTIONS.reduce((acc, sec) => {
    acc[sec] = allHomework.filter(hw => hw.sections.includes(sec)).length;
    return acc;
  }, {} as Record<string, number>);

  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math")) return "🔢";
    if (s.includes("english")) return "📖";
    if (s.includes("evs") || s.includes("science")) return "🌿";
    if (s.includes("hindi")) return "🪷";
    if (s.includes("kannada")) return "🏛️";
    if (s.includes("computer")) return "💻";
    return "📝";
  };

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sortedDates.length > 0) {
      const initial: Record<string, boolean> = {};
      sortedDates.forEach((date, index) => { initial[date] = index < 3; });
      setExpandedDates(initial);
    }
  }, [selectedSection, allHomework, sortedDates.join("|")]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yesterday = new Date(); yesterday.setDate(today.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
      dateObj.setHours(0, 0, 0, 0);
      if (dateObj.getTime() === today.getTime()) return `Today (${dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" })})`;
      if (dateObj.getTime() === yesterday.getTime()) return `Yesterday (${dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" })})`;
      return dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    } catch { return dateStr; }
  };

  const getDayEmoji = (dateStr: string) => {
    const day = dateStr.split("-")[2] || "0";
    const digitMap: Record<string, string> = { "0": "0️⃣", "1": "1️⃣", "2": "2️⃣", "3": "3️⃣", "4": "4️⃣", "5": "5️⃣", "6": "6️⃣", "7": "7️⃣", "8": "8️⃣", "9": "9️⃣" };
    return day.split("").map(c => digitMap[c] || c).join("");
  };

  const isFromSheet = fromSheet;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>📚</span> Homework
        </h2>
        {isFromSheet && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full border border-green-200">LIVE</span>
        )}
      </div>

      {/* Section Navigator */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Section</span>
          <span className="text-[10px] font-medium text-gray-400">
            {filteredList.length} {filteredList.length === 1 ? "assignment" : "assignments"}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {ALL_SECTIONS.map(sec => {
            const count = sectionCounts[sec];
            const isSelected = sec === selectedSection;
            const isMine = sec === pinnedSection;
            return (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5 min-w-[44px] ${
                  isSelected
                    ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200"
                    : isMine
                    ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span>{sec.replace("I-", "")}</span>
                {count > 0 && (
                  <span className={`text-[8px] font-black ${
                    isSelected ? "text-orange-200" : isMine ? "text-orange-400" : "text-gray-300"
                  }`}>
                    {count}
                  </span>
                )}
                {isMine && !isSelected && (
                  <span className="text-[7px] text-orange-500 font-bold">★</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Currently Viewing Banner */}
      <div className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold mb-5 ${
        selectedSection === pinnedSection
          ? "bg-orange-50 text-orange-700 border border-orange-200"
          : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}>
        <div className="flex items-center gap-2">
          <span>{selectedSection === pinnedSection ? "🏠" : "👁️"}</span>
          <span>
            Section {selectedSection}
            {selectedSection === pinnedSection && " (My Section)"}
          </span>
        </div>
        {selectedSection !== pinnedSection && (
          <button
            onClick={() => handlePinSection(selectedSection)}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            📌 Set as My Section
          </button>
        )}
      </div>

      {/* Homework List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-500 animate-pulse text-sm">Fetching homework...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
          <div className="text-6xl mb-4 opacity-50">📭</div>
          <p className="text-xl text-gray-500 font-bold">No homework for Section {selectedSection}</p>
          <p className="text-sm text-gray-400 mt-2">No assignments found for this section yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const isExpanded = expandedDates[date];
            const list = groupedByDate[date];
            return (
              <div key={date} className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-150 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl flex">{getDayEmoji(date)}</span>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">{formatDateLabel(date)}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{list.length} {list.length === 1 ? "assignment" : "assignments"}</p>
                    </div>
                  </div>
                  <span className={`text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {isExpanded && (
                  <div className="p-6 space-y-6 bg-white divide-y divide-gray-100">
                    {list.map((hw) => (
                      <div key={hw.id} className="pt-5 first:pt-0 flex flex-col gap-2 relative">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            {hw.title && <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{hw.title}</h4>}
                            <div className="flex items-center gap-2">
                              <span className="text-base">{getSubjectIcon(hw.subject)}</span>
                              <span className="font-extrabold text-gray-900 text-sm md:text-base tracking-tight">{hw.subject}</span>
                            </div>
                          </div>
                          {hw.submissionDate && (
                            <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100 flex items-center gap-1">
                              ⏰ Submit by: {hw.submissionDate}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-700 leading-relaxed text-sm md:text-base bg-gray-50/50 rounded-2xl p-4 border border-gray-100/80 mt-1 whitespace-pre-line">
                          {hw.description}
                        </div>
                        {hw.attachmentImage && (
                          <a
                            href={hw.attachmentImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-1"
                            title="Open attachment"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={hw.attachmentImage}
                              alt={`${hw.title} - attached picture`}
                              className="rounded-2xl border border-gray-200 max-h-80 w-auto shadow-sm hover:shadow-md transition-shadow"
                            />
                          </a>
                        )}
                        {/* Section badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Sections:</span>
                          {hw.sections.map(sec => (
                            <span
                              key={sec}
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                sec === selectedSection
                                  ? "bg-orange-100 text-orange-800 border-orange-300"
                                  : "bg-white text-gray-500 border-gray-200"
                              }`}
                            >
                              {sec}
                            </span>
                          ))}
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

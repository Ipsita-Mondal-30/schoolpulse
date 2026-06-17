"use client";

import { useState, useEffect } from "react";
import { fetchHomework, Homework } from "../actions";
import { getToday } from "@/lib/data";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import HomeworkShareButton from "@/components/HomeworkShareButton";
import HomeworkScanner from "@/components/HomeworkScanner";
import schoolHomeworkData from "@/data/school-homework.json";

const MY_SECTION = "I-A";

const ALL_SECTIONS = ["I-A", "I-B", "I-C", "I-D", "I-E", "I-F", "I-G", "I-H", "I-I", "I-J", "I-K"];

interface SchoolHomework {
  id: string;
  title: string;
  subject: string;
  sections: string[];
  description: string;
  sentDate: string;
}

export default function HomeworkPage() {
  const [activeTab, setActiveTab] = useState<"class" | "school">("class");
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>(MY_SECTION);

  const handleHomeworkScanned = (newHw: {
    subject: string;
    chapter: string;
    content: string;
    submissionDate: string;
    assignedDate?: string;
  }) => {
    const assignedDate = newHw.assignedDate || getToday();
    const homeworkItem: Homework = {
      id: `hw-scanned-${Date.now()}`,
      status: "Active",
      subject: newHw.subject,
      content: newHw.content,
      submissionDate: newHw.submissionDate,
      notes: JSON.stringify({ assigned: assignedDate, chapter: newHw.chapter }),
      createdAt: assignedDate
    };

    setHomeworkList(prev => {
      const updated = [homeworkItem, ...prev];
      if (typeof window !== "undefined") {
        localStorage.setItem("homework_cache_data", JSON.stringify(updated));
        localStorage.setItem("homework_cache_time", String(Date.now()));
      }
      return updated;
    });
  };

  const loadData = async (forceRefresh = false) => {
    if (!forceRefresh && typeof window !== "undefined") {
      const cached = localStorage.getItem("homework_cache_data");
      const cachedTime = localStorage.getItem("homework_cache_time");
      if (cached && cachedTime) {
        const age = Date.now() - Number(cachedTime);
        if (age < 15 * 60 * 1000) {
          setHomeworkList(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const data = await fetchHomework();
      let localScanned: Homework[] = [];
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("homework_cache_data");
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Homework[];
            localScanned = parsed.filter(item => item.id.startsWith("hw-scanned-"));
          } catch (e) {}
        }
      }
      const mergedData = [...localScanned, ...data];
      setHomeworkList(mergedData);
      if (typeof window !== "undefined") {
        localStorage.setItem("homework_cache_data", JSON.stringify(mergedData));
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
    let assigned = hw.createdAt || "Unknown Date";
    if (hw.notes && hw.notes.startsWith("Assigned: ")) {
      assigned = hw.notes.replace("Assigned: ", "").trim();
    }
    return { assigned, chapter: "" };
  };

  const groupedHomework = homeworkList.reduce((acc, hw) => {
    const { assigned } = getHwMeta(hw);
    if (!acc[assigned]) acc[assigned] = [];
    acc[assigned].push(hw);
    return acc;
  }, {} as Record<string, Homework[]>);

  const sortedDates = Object.keys(groupedHomework).sort((a, b) => {
    if (a === "Unknown Date") return 1;
    if (b === "Unknown Date") return -1;
    const parseDate = (dStr: string) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        const day = Number(parts[0]);
        const year = Number(parts[2]);
        const monthMap: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
        const month = monthMap[parts[1].toLowerCase().substring(0,3)] ?? Number(parts[1]) - 1;
        return new Date(year, month, day).getTime();
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

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sortedDates.length > 0) {
      const initial: Record<string, boolean> = {};
      sortedDates.forEach((date, index) => { initial[date] = index < 3; });
      setExpandedDates(initial);
    }
  }, [homeworkList]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === "Unknown Date") return dateStr;
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        let dateObj: Date;
        if (parts[0].length === 4) {
          dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          const day = Number(parts[0]);
          const year = Number(parts[2]);
          const monthMap: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
          const month = monthMap[parts[1].toLowerCase().substring(0,3)] ?? Number(parts[1]) - 1;
          dateObj = new Date(year, month, day);
        }
        const today = new Date(); today.setHours(0,0,0,0);
        const yesterday = new Date(); yesterday.setDate(today.getDate()-1); yesterday.setHours(0,0,0,0);
        dateObj.setHours(0,0,0,0);
        if (dateObj.getTime() === today.getTime()) return `Today (${dateObj.toLocaleDateString("en-US", { month:"long", day:"numeric" })})`;
        if (dateObj.getTime() === yesterday.getTime()) return `Yesterday (${dateObj.toLocaleDateString("en-US", { month:"long", day:"numeric" })})`;
        return dateObj.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
      }
      return dateStr;
    } catch (e) { return dateStr; }
  };

  // School homework logic
  const allSchoolHw = schoolHomeworkData as SchoolHomework[];
  const filteredSchoolHw = allSchoolHw.filter(hw => hw.sections.includes(selectedSection));

  const schoolHwByDate = filteredSchoolHw.reduce((acc, hw) => {
    if (!acc[hw.sentDate]) acc[hw.sentDate] = [];
    acc[hw.sentDate].push(hw);
    return acc;
  }, {} as Record<string, SchoolHomework[]>);

  const schoolSortedDates = Object.keys(schoolHwByDate).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  );

  const sectionHomeworkCounts = ALL_SECTIONS.reduce((acc, sec) => {
    acc[sec] = allSchoolHw.filter(hw => hw.sections.includes(sec)).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>📚</span> Homework
        </h2>
        <div className="flex items-center gap-3">
          {activeTab === "class" && <HomeworkShareButton homeworkList={homeworkList} />}
          <button
            onClick={() => loadData(true)}
            className="p-2 text-gray-500 hover:text-orange-500 transition-all rounded-xl hover:bg-orange-50 border border-gray-200 bg-white shadow-sm flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh Data"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-5 bg-gray-100 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab("class")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "class"
              ? "bg-white text-orange-700 shadow-sm border border-orange-100"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>📝</span> Class Teacher
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === "class" ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-500"
          }`}>
            {homeworkList.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("school")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "school"
              ? "bg-white text-blue-700 shadow-sm border border-blue-100"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>🏫</span> School Notice
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === "school" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
          }`}>
            {filteredSchoolHw.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Class Teacher Homework */}
      {activeTab === "class" && (
        <>
          <HomeworkScanner onHomeworkScanned={handleHomeworkScanned} />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-500 animate-pulse text-sm">Fetching active homework planner...</p>
            </div>
          ) : homeworkList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="text-6xl mb-4 opacity-50">📝</div>
              <p className="text-xl text-gray-500 font-bold">No homework assignments found.</p>
              <p className="text-sm text-gray-400 mt-2">Check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => {
                const isExpanded = expandedDates[date];
                const list = groupedHomework[date];
                return (
                  <div key={date} className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-150 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl flex">
                          {(() => {
                            let dayVal = "";
                            const parts = date.split("-");
                            if (parts.length === 3) {
                              dayVal = parts[0].length === 4 ? parts[2] : parts[0];
                            }
                            const finalDay = dayVal || "12";
                            const digitMap: Record<string, string> = {"0":"0️⃣","1":"1️⃣","2":"2️⃣","3":"3️⃣","4":"4️⃣","5":"5️⃣","6":"6️⃣","7":"7️⃣","8":"8️⃣","9":"9️⃣"};
                            return finalDay.split("").map(char => digitMap[char] || char).join("");
                          })()}
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm md:text-base">{formatDateLabel(date)}</h3>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">{list.length} {list.length === 1 ? "assignment" : "assignments"}</p>
                        </div>
                      </div>
                      <span className={`text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {isExpanded && (
                      <div className="p-6 space-y-6 bg-white divide-y divide-gray-100">
                        {list.map((hw) => {
                          const { chapter } = getHwMeta(hw);
                          return (
                            <div key={hw.id} className="pt-5 first:pt-0 flex flex-col gap-2 relative">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-col gap-1">
                                  {chapter && <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{chapter}</h4>}
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{getSubjectIcon(hw.subject)}</span>
                                    <span className="font-extrabold text-gray-900 text-sm md:text-base tracking-tight">{hw.subject}</span>
                                    <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border rounded-md bg-orange-100 text-orange-700 border-orange-200">I-A</span>
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
        </>
      )}

      {/* TAB 2: School Notice Homework */}
      {activeTab === "school" && (
        <div className="space-y-4">
          {/* Section Navigator */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Section</span>
              <span className="text-[10px] font-medium text-gray-400">
                {filteredSchoolHw.length} {filteredSchoolHw.length === 1 ? "notice" : "notices"}
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {ALL_SECTIONS.map(sec => {
                const count = sectionHomeworkCounts[sec];
                const isSelected = sec === selectedSection;
                const isMine = sec === MY_SECTION;
                return (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5 min-w-[44px] ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                        : isMine
                        ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span>{sec.replace("I-", "")}</span>
                    {count > 0 && (
                      <span className={`text-[8px] font-black ${
                        isSelected ? "text-blue-200" : isMine ? "text-orange-400" : "text-gray-300"
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
          <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-bold ${
            selectedSection === MY_SECTION
              ? "bg-orange-50 text-orange-700 border border-orange-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            <span>{selectedSection === MY_SECTION ? "🏠" : "👁️"}</span>
            <span>
              Viewing homework for Section {selectedSection}
              {selectedSection === MY_SECTION && " (Your Section)"}
            </span>
          </div>

          {/* School Homework Cards */}
          {filteredSchoolHw.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="text-5xl mb-3 opacity-50">📭</div>
              <p className="text-base text-gray-500 font-bold">No homework for Section {selectedSection}</p>
              <p className="text-xs text-gray-400 mt-1">No school-level notices sent to this section yet.</p>
            </div>
          ) : (
            schoolSortedDates.map(date => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 shrink-0">
                    {formatDateLabel(date)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="space-y-3">
                  {schoolHwByDate[date].map(hw => {
                    const isForMySection = hw.sections.includes(MY_SECTION);
                    return (
                      <div
                        key={hw.id}
                        className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
                          isForMySection
                            ? "border-orange-200 ring-1 ring-orange-100"
                            : "border-gray-200"
                        }`}
                      >
                        {/* Card Header */}
                        <div className={`px-4 py-3 flex items-start justify-between gap-2 ${
                          isForMySection ? "bg-orange-50/50" : "bg-gray-50/50"
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg shrink-0">{getSubjectIcon(hw.subject)}</span>
                            <div className="min-w-0">
                              <div className="font-extrabold text-gray-900 text-sm">{hw.title}</div>
                              <div className="text-[11px] text-gray-500 font-medium">{hw.subject}</div>
                            </div>
                          </div>
                          {isForMySection && (
                            <span className="shrink-0 px-2 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded-full uppercase tracking-wider">
                              Your Section
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <div className="px-4 py-3 border-t border-gray-100">
                          <p className="text-sm text-gray-700 leading-relaxed">{hw.description}</p>
                        </div>

                        {/* Section Badges — shows all sections this homework was sent to */}
                        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Sent to:</span>
                          {hw.sections.map(sec => (
                            <span
                              key={sec}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                sec === selectedSection
                                  ? "bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-200"
                                  : sec === MY_SECTION
                                  ? "bg-orange-100 text-orange-800 border-orange-300"
                                  : "bg-white text-gray-500 border-gray-200"
                              }`}
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

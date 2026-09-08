"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import noticesMeta from "@/data/notices.json";
import { filterNoticesByClass, type UiNoticeItem } from "@/lib/ui-merge";
import { useNoticesQuery } from "@/lib/queries/notices";

// ── Types ──────────────────────────────────────────────────────────────────────
type Notice = UiNoticeItem;

// ── Subject inference (from message keywords) ──────────────────────────────────
type SubjectMeta = { label: string; icon: string; badge: string; ring: string; gradient: string };

const SUBJECTS: { test: RegExp; meta: SubjectMeta }[] = [
  { test: /english|worksheet|meet my family|spelling/i, meta: { label: "English", icon: "📖", badge: "bg-sky-100 text-sky-700", ring: "ring-sky-200", gradient: "from-sky-500 to-blue-600" } },
  { test: /hindi/i, meta: { label: "Hindi", icon: "🪷", badge: "bg-rose-100 text-rose-700", ring: "ring-rose-200", gradient: "from-rose-500 to-pink-600" } },
  { test: /kannada|akshara/i, meta: { label: "Kannada", icon: "🏛️", badge: "bg-amber-100 text-amber-700", ring: "ring-amber-200", gradient: "from-amber-500 to-orange-600" } },
  { test: /\bmath|maths|mathematics|addition|subtraction/i, meta: { label: "Maths", icon: "🔢", badge: "bg-violet-100 text-violet-700", ring: "ring-violet-200", gradient: "from-violet-500 to-purple-600" } },
  { test: /\bevs\b|environment|body clean/i, meta: { label: "EVS", icon: "🌿", badge: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200", gradient: "from-emerald-500 to-teal-600" } },
  { test: /computer|coding/i, meta: { label: "Computer", icon: "💻", badge: "bg-indigo-100 text-indigo-700", ring: "ring-indigo-200", gradient: "from-indigo-500 to-blue-600" } },
];

const GENERAL_META: SubjectMeta = { label: "Notice", icon: "📢", badge: "bg-gray-100 text-gray-700", ring: "ring-gray-200", gradient: "from-slate-500 to-gray-600" };

function subjectMeta(n: Notice): SubjectMeta {
  const hay = `${n.summary} ${n.message}`;
  for (const s of SUBJECTS) if (s.test.test(hay)) return s.meta;
  return GENERAL_META;
}

// ── Action / link detection ────────────────────────────────────────────────────
const ACTION_RE = /\b(submit|send it back|send the|send back|bring|carry|return|keep at home|send in the bag)\b/i;
const LIBRARY_RE = /content library|uploaded|answer key|revision paper|worksheet/i;
const DUE_RE = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/;

function isAction(n: Notice) {
  return ACTION_RE.test(`${n.summary} ${n.message}`);
}
function mentionsLibrary(n: Notice) {
  return LIBRARY_RE.test(`${n.summary} ${n.message}`);
}
function dueDate(n: Notice): string | null {
  const m = n.message.match(DUE_RE);
  return m ? m[1] : null;
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
function dateParts(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { day: "—", monthAbbr: "—", weekday: "—" };
  }
  const [y, m, d] = iso.split("-").map(Number);
  const obj = new Date(y, m - 1, d);
  return {
    day: obj.getDate(),
    monthAbbr: obj.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
    weekday: obj.toLocaleString("en-IN", { weekday: "short" }),
  };
}
function formatDateFull(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Undated";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// ── Notice Card ─────────────────────────────────────────────────────────────────
function NoticeCard({ notice, today, activeClass }: { notice: Notice; today: string; activeClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const meta = subjectMeta(notice);
  const action = isAction(notice);
  const library = mentionsLibrary(notice);
  const due = dueDate(notice);
  const isNew = today !== "" && daysBetween(notice.date, today) >= 0 && daysBetween(notice.date, today) <= 2;
  const isToday = notice.date === today;

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
    >
      <div className={`h-1 w-full bg-gradient-to-r ${meta.gradient}`} />
      <div className="p-4 flex gap-3.5">
        {/* Subject icon */}
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
          {meta.icon}
        </div>

        <div className="min-w-0 flex-1">
          {/* Top row: subject + time */}
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}>
              {meta.label}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isNew && (
                <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                  New
                </span>
              )}
              <span className="text-[11px] text-gray-400 font-semibold whitespace-nowrap">🕐 {formatTime(notice.time)}</span>
            </div>
          </div>

          {/* Summary */}
          <h3 className="mt-1.5 font-bold text-gray-800 text-sm sm:text-[15px] leading-snug">{notice.summary}</h3>

          {/* Message */}
          <p className={`mt-1 text-xs sm:text-[13px] text-gray-500 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {notice.message}
          </p>

          {/* Tags row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {action && (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full">
                ⚡ Action needed
              </span>
            )}
            {due && (
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">
                📌 Due {due}
              </span>
            )}
            {/* Class badges */}
            {notice.classes.map((c) => {
              const on = activeClass !== "All" && c === activeClass;
              return (
                <span
                  key={c}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${
                    on ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {c}
                </span>
              );
            })}
          </div>

          {/* Content library link */}
          {library && (
            <Link
              href="/class-diary"
              onClick={(e) => e.stopPropagation()}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            >
              📎 Open Content Library →
            </Link>
          )}

          {isToday && (
            <span className="ml-2 text-[9px] font-black text-orange-500 uppercase tracking-wide">• Today</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
type Mode = "all" | "day";

export default function NoticesPage() {
  const { data, isError, error } = useNoticesQuery();
  const notices = data ?? [];

  useEffect(() => {
    if (isError) {
      console.error("Failed to fetch notices", error);
    }
  }, [isError, error]);

  // Server already returns newest-first; keep stable reference
  const sorted = notices;

  // Unique notice dates, newest-first
  const availableDates = useMemo(() => Array.from(new Set(sorted.map((n) => n.date))), [sorted]);

  // All classes present, sorted
  const allClasses = useMemo(
    () => Array.from(new Set(sorted.flatMap((n) => n.classes))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [sorted]
  );

  const [mode, setMode] = useState<Mode>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeClass, setActiveClass] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // Compute "today" client-side to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setToday(t);
  }, []);

  const oldestDate = availableDates[availableDates.length - 1] ?? "";
  const newestDate = availableDates[0] ?? "";

  // Step to previous (older) / next (newer) notice date
  const stepDate = (dir: "prev" | "next") => {
    if (availableDates.length === 0) return;
    let idx = availableDates.indexOf(selectedDate);
    if (idx === -1) {
      // selected date not a notice date — snap to nearest notice date in that direction
      const target = availableDates.find((d) => (dir === "prev" ? d < selectedDate : d > selectedDate));
      if (target) setSelectedDate(target);
      else setSelectedDate(dir === "prev" ? newestDate : oldestDate);
      return;
    }
    idx = dir === "prev" ? Math.min(idx + 1, availableDates.length - 1) : Math.max(idx - 1, 0);
    setSelectedDate(availableDates[idx]);
  };

  // Class + search filter applied to a list
  const applyFilters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list: Notice[]) =>
      filterNoticesByClass(list, activeClass).filter((n) => {
        if (!q) return true;
        return (
          n.summary.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          n.classes.some((c) => c.toLowerCase().includes(q))
        );
      });
  }, [activeClass, search]);

  // Grouped output (date -> notices), newest-first
  const groups = useMemo(() => {
    const base = mode === "day" ? sorted.filter((n) => n.date === selectedDate) : sorted;
    const filtered = applyFilters(base);
    const map = new Map<string, Notice[]>();
    for (const n of filtered) {
      const arr = map.get(n.date) ?? [];
      arr.push(n);
      map.set(n.date, arr);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return b.localeCompare(a);
    });
  }, [mode, selectedDate, sorted, applyFilters]);

  const totalShown = groups.reduce((a, [, items]) => a + items.length, 0);
  const dayHasNotices = availableDates.includes(selectedDate);

  return (
    <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 shadow-md shadow-purple-200">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📢</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide uppercase">Daily Notices</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-purple-100">
            Notices from the school's parent portal. Pick a date or filter by your child's section.
          </p>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="mt-4 flex gap-2 bg-gray-100 p-1 rounded-2xl">
        {([
          { id: "all", label: "All notices", icon: "🗂️" },
          { id: "day", label: "Pick a date", icon: "📅" },
        ] as { id: Mode; label: string; icon: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              mode === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Date navigator (day mode) ── */}
      {mode === "day" && (
        <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => stepDate("prev")}
              aria-label="Older date"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors text-lg font-bold"
            >
              ‹
            </button>

            <label className="flex-1 relative">
              <input
                type="date"
                value={selectedDate}
                min={oldestDate}
                max={today || newestDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              />
            </label>

            <button
              onClick={() => stepDate("next")}
              aria-label="Newer date"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors text-lg font-bold"
            >
              ›
            </button>
          </div>

          {selectedDate && (
            <p className="mt-2 text-center text-xs font-semibold text-gray-500">
              {formatDateFull(selectedDate)}
              {selectedDate === today && <span className="ml-1.5 text-orange-500 font-black">· Today</span>}
            </p>
          )}

          {/* Quick date chips */}
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            <button
              onClick={() => setSelectedDate(newestDate)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                selectedDate === newestDate ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-500 border-gray-200 hover:bg-purple-50"
              }`}
            >
              ✨ Latest
            </button>
            {today && (
              <button
                onClick={() => setSelectedDate(today)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  selectedDate === today ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-500 border-gray-200 hover:bg-orange-50"
                }`}
              >
                📍 Today
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="mt-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search notices…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* ── Class filter ── */}
      <div className="mt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-1">Filter by section</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveClass("All")}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeClass === "All" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All sections
          </button>
          {allClasses.map((c) => (
            <button
              key={c}
              onClick={() => setActiveClass(c)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeClass === c ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-orange-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── Result count ── */}
      <p className="mt-4 text-xs text-gray-400 font-medium px-1">
        {totalShown} {totalShown === 1 ? "notice" : "notices"}
        {activeClass !== "All" && ` for ${activeClass}`}
        {mode === "day" && dayHasNotices && ` on this day`}
      </p>

      {/* ── Notices ── */}
      {totalShown === 0 ? (
        <div className="mt-6 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <div className="text-5xl mb-3 opacity-40">📭</div>
          <p className="text-gray-500 font-medium">
            {mode === "day" ? "No notices on this date" : "No notices match your filters"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {mode === "day" ? "Try the ‹ › arrows or tap “Latest”." : "Try clearing the search or section filter."}
          </p>
        </div>
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="mt-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xs sm:text-sm font-bold text-purple-700 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
                📅 {formatDateFull(date)}
                {date === today && <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full">TODAY</span>}
              </h2>
              <div className="h-px flex-1 bg-purple-100" />
              <span className="text-[10px] sm:text-xs font-semibold text-gray-400 whitespace-nowrap">
                {items.length} {items.length === 1 ? "notice" : "notices"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {items.map((n) => (
                <NoticeCard key={n.id} notice={n} today={today} activeClass={activeClass} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* ── Footer note ── */}
      <p className="mt-8 text-center text-[11px] text-gray-400">
        Source: {noticesMeta.source} · Last synced {noticesMeta.lastSynced} · {notices.length} notices (JSON + NeverSkip)
      </p>
    </main>
  );
}

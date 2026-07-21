"use client";

import { useMemo, useState, useEffect } from "react";
import libraryData from "@/data/content-library.json";

// ── Types ──────────────────────────────────────────────────────────────────────
type Media = { type: string; file: string };
type Resource = {
  id: string;
  subject: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  section: string;
  media: Media[];
};

const MEDIA_BASE = libraryData.mediaBase;
const resources = libraryData.resources as Resource[];

// ── Subject styling ─────────────────────────────────────────────────────────────
type SubjectStyle = { icon: string; badge: string; grad: string; dot: string; soft: string };
const SUBJECTS: Record<string, SubjectStyle> = {
  ENGLISH: { icon: "📖", badge: "bg-sky-100 text-sky-700", grad: "from-sky-500 to-blue-600", dot: "bg-sky-500", soft: "bg-sky-50" },
  HINDI: { icon: "🪷", badge: "bg-rose-100 text-rose-700", grad: "from-rose-500 to-pink-600", dot: "bg-rose-500", soft: "bg-rose-50" },
  KANNADA: { icon: "🏛️", badge: "bg-amber-100 text-amber-700", grad: "from-amber-500 to-orange-600", dot: "bg-amber-500", soft: "bg-amber-50" },
  MATHEMATICS: { icon: "🔢", badge: "bg-violet-100 text-violet-700", grad: "from-violet-500 to-purple-600", dot: "bg-violet-500", soft: "bg-violet-50" },
  "E.V.S": { icon: "🌿", badge: "bg-emerald-100 text-emerald-700", grad: "from-emerald-500 to-teal-600", dot: "bg-emerald-500", soft: "bg-emerald-50" },
  "COMPUTER SCIENCE": { icon: "💻", badge: "bg-indigo-100 text-indigo-700", grad: "from-indigo-500 to-blue-600", dot: "bg-indigo-500", soft: "bg-indigo-50" },
};
const DEFAULT_STYLE: SubjectStyle = { icon: "📚", badge: "bg-gray-100 text-gray-700", grad: "from-slate-500 to-gray-600", dot: "bg-gray-400", soft: "bg-gray-50" };
const styleFor = (s: string) => SUBJECTS[s.toUpperCase()] ?? DEFAULT_STYLE;
const prettySubject = (s: string) => (s.toUpperCase() === "E.V.S" ? "EVS" : s.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()));

// Cross-cutting "Practice Paper" detection (spans every subject)
const PRACTICE_KEY = "__practice__";
const isPracticePaper = (r: Resource) =>
  /practice\s*paper/i.test(r.title) || r.media.some((m) => /practicepaper/i.test(m.file));

// ── Helpers ─────────────────────────────────────────────────────────────────────
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
const formatDateFull = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
};
const formatDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

// Smart label for a media file
function mediaLabel(file: string, type: string, idx: number, total: number): string {
  if (type === "I") return "Image";
  const f = file.toLowerCase();
  if (/answerkey|answer-key|ppak|paperak|papaerak|-ak|_ak|ak_|ak1|ak2|[0-9]ak|revpaper-\d+ak|revision\d*ak|rev\d*ak/.test(f)) return "Answer Key";
  if (/questionpaper|ppqp|paperqp|-qp|_qp|qp_|qp1|qp2/.test(f)) return "Question Paper";
  if (/worksheet|ws1|ws2|ws\d/.test(f)) return "Worksheet";
  if (/practicepaper|practice/.test(f)) return "Practice Paper";
  if (/notes/.test(f)) return "Notes";
  if (/revision|rev-?\d/.test(f)) return "Revision Paper";
  if (/workbook|wb\d/.test(f)) return "Workbook";
  return total > 1 ? `PDF ${idx + 1}` : "Open PDF";
}

// ── PDF thumbnail ───────────────────────────────────────────────────────────────
function DocThumb({ isImage }: { isImage: boolean }) {
  return (
    <div className={`relative w-14 h-16 shrink-0 rounded-lg border-2 ${isImage ? "border-blue-200" : "border-red-200"} bg-white shadow-sm flex flex-col items-center justify-center`}>
      <div className={`absolute top-0 right-0 w-4 h-4 ${isImage ? "bg-blue-100 border-blue-200" : "bg-red-100 border-red-200"} rounded-bl-lg border-l-2 border-b-2`} />
      <span className="text-xl">{isImage ? "🖼️" : "📄"}</span>
      <span className={`text-[9px] font-black tracking-wider ${isImage ? "text-blue-500" : "text-red-500"}`}>{isImage ? "IMG" : "PDF"}</span>
    </div>
  );
}

// ── Resource card ───────────────────────────────────────────────────────────────
function ResourceCard({ res, today }: { res: Resource; today: string }) {
  const [expanded, setExpanded] = useState(false);
  const st = styleFor(res.subject);
  const isNew = today !== "" && daysBetween(res.date, today) >= 0 && daysBetween(res.date, today) <= 3;
  const primaryIsImage = res.media[0]?.type === "I";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${st.grad}`} />
      <div className="p-4 flex gap-3.5">
        <DocThumb isImage={primaryIsImage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-800 text-sm sm:text-[15px] leading-snug">{res.title}</h3>
            {isNew && (
              <span className="shrink-0 text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-pulse">New</span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${st.badge}`}>
              {st.icon} {prettySubject(res.subject)}
            </span>
            <span className="text-[11px] text-gray-400 font-semibold">📅 {formatDateShort(res.date)}</span>
            {res.section && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{res.section}</span>}
          </div>

          {res.description && (
            <p
              onClick={() => setExpanded((e) => !e)}
              className={`mt-1.5 text-xs sm:text-[13px] text-gray-500 leading-relaxed cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
            >
              {res.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap gap-2">
            {res.media.map((m, i) => {
              const isImg = m.type === "I";
              return (
                <a
                  key={i}
                  href={MEDIA_BASE + m.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${
                    isImg
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600"
                  }`}
                >
                  <span>{isImg ? "🖼️" : "📎"}</span> {mediaLabel(m.file, m.type, i, res.media.length)}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────
type GroupBy = "subject" | "date";

export default function ContentLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [activeMonth, setActiveMonth] = useState("All");
  const [groupBy, setGroupBy] = useState<GroupBy>("subject");
  const [today, setToday] = useState("");

  useEffect(() => {
    const n = new Date();
    setToday(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
  }, []);

  // Subject list with counts (sorted by count desc)
  const subjectCounts = useMemo(() => {
    const c = new Map<string, number>();
    resources.forEach((r) => c.set(r.subject, (c.get(r.subject) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  // Practice-paper count (cross-subject filter)
  const practiceCount = useMemo(() => resources.filter(isPracticePaper).length, []);

  // Months present (desc)
  const months = useMemo(() => Array.from(new Set(resources.map((r) => monthKey(r.date)))).sort((a, b) => b.localeCompare(a)), []);

  const totalFiles = useMemo(() => resources.reduce((a, r) => a + r.media.length, 0), []);
  const latestDate = useMemo(() => resources.map((r) => r.date).sort().slice(-1)[0], []);

  // Filtered set
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => {
        if (activeSubject === PRACTICE_KEY) {
          if (!isPracticePaper(r)) return false;
        } else if (activeSubject !== "All" && r.subject !== activeSubject) return false;
        if (activeMonth !== "All" && monthKey(r.date) !== activeMonth) return false;
        if (!q) return true;
        return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || prettySubject(r.subject).toLowerCase().includes(q);
      })
      .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
  }, [search, activeSubject, activeMonth]);

  // Grouping
  const groups = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of filtered) {
      const key = groupBy === "subject" ? r.subject : r.date;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    const entries = [...map.entries()];
    if (groupBy === "subject") entries.sort((a, b) => b[1].length - a[1].length);
    else entries.sort((a, b) => b[0].localeCompare(a[0]));
    return entries;
  }, [filtered, groupBy]);

  return (
    <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 shadow-md shadow-purple-200">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗂️</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide uppercase">Content Library</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-purple-100">
            Every worksheet, revision paper, answer key and note from the parent portal — grouped and searchable.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">{resources.length} resources</span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">{subjectCounts.length} subjects</span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">{totalFiles} files</span>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by title, subject or keyword…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* ── Subject filter ── */}
      <div className="mt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-1">Subject</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubject("All")}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeSubject === "All" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            🗂️ All · {resources.length}
          </button>
          <button
            onClick={() => setActiveSubject(PRACTICE_KEY)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeSubject === PRACTICE_KEY ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            }`}
          >
            🎯 Practice Papers · {practiceCount}
          </button>
          {subjectCounts.map(([s, n]) => {
            const st = styleFor(s);
            const active = activeSubject === s;
            return (
              <button
                key={s}
                onClick={() => setActiveSubject(s)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                  active ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-purple-50"
                }`}
              >
                {st.icon} {prettySubject(s)} · {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Month + Group controls ── */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveMonth("All")}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeMonth === "All" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:bg-orange-50"
            }`}
          >
            📅 All dates
          </button>
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMonth(m)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeMonth === m ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-orange-50"
              }`}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl shrink-0">
          {([
            { id: "subject", label: "By subject", icon: "📚" },
            { id: "date", label: "By date", icon: "🗓️" },
          ] as { id: GroupBy; label: string; icon: string }[]).map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupBy(g.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all ${
                groupBy === g.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{g.icon}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Result count ── */}
      <p className="mt-4 text-xs text-gray-400 font-medium px-1">
        {filtered.length} {filtered.length === 1 ? "resource" : "resources"}
        {activeSubject === PRACTICE_KEY ? " · Practice Papers" : activeSubject !== "All" && ` · ${prettySubject(activeSubject)}`}
        {activeMonth !== "All" && ` · ${monthLabel(activeMonth)}`}
      </p>

      {/* ── Groups ── */}
      {filtered.length === 0 ? (
        <div className="mt-6 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <div className="text-5xl mb-3 opacity-40">🔍</div>
          <p className="text-gray-500 font-medium">No resources match your filters</p>
          <p className="text-xs text-gray-400 mt-1">Try clearing the search or picking “All”.</p>
        </div>
      ) : (
        groups.map(([key, items]) => {
          const isSubject = groupBy === "subject";
          const st = isSubject ? styleFor(key) : DEFAULT_STYLE;
          return (
            <section key={key} className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 text-gray-700">
                  {isSubject ? (
                    <>
                      <span className={`inline-flex w-5 h-5 items-center justify-center rounded-md ${st.soft}`}>{st.icon}</span>
                      {prettySubject(key)}
                    </>
                  ) : (
                    <span className="text-purple-700">📅 {formatDateFull(key)}</span>
                  )}
                </h2>
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-[10px] sm:text-xs font-semibold text-gray-400 whitespace-nowrap">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((res) => (
                  <ResourceCard key={res.id} res={res} today={today} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* ── Footer ── */}
      <p className="mt-8 text-center text-[11px] text-gray-400">
        Source: {libraryData.source} · Last synced {libraryData.lastSynced}
      </p>
    </main>
  );
}

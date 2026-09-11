"use client";

import { useMemo, useState, useEffect } from "react";
import libraryData from "@/data/content-library.json";

// ── Types ──────────────────────────────────────────────────────────────────────
type Media = { type: string; file: string; url?: string };
type Resource = {
  id: string;
  subject: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  section: string;
  category?: string;
  grade?: string;
  monthLabel?: string;
  media: Media[];
};

const MEDIA_BASE = libraryData.mediaBase;
const resources = libraryData.resources as Resource[];

function mediaHref(m: Media): string {
  if (m.url) return m.url;
  return MEDIA_BASE + m.file;
}

// ── Subject styling ─────────────────────────────────────────────────────────────
type SubjectStyle = { icon: string; badge: string; grad: string; dot: string; soft: string };
const SUBJECTS: Record<string, SubjectStyle> = {
  ENGLISH: { icon: "📖", badge: "bg-sky-100 text-sky-700", grad: "from-sky-500 to-blue-600", dot: "bg-sky-500", soft: "bg-sky-50" },
  HINDI: { icon: "🪷", badge: "bg-rose-100 text-rose-700", grad: "from-rose-500 to-pink-600", dot: "bg-rose-500", soft: "bg-rose-50" },
  KANNADA: { icon: "🏛️", badge: "bg-amber-100 text-amber-700", grad: "from-amber-500 to-orange-600", dot: "bg-amber-500", soft: "bg-amber-50" },
  MATHEMATICS: { icon: "🔢", badge: "bg-violet-100 text-violet-700", grad: "from-violet-500 to-purple-600", dot: "bg-violet-500", soft: "bg-violet-50" },
  "E.V.S": { icon: "🌿", badge: "bg-emerald-100 text-emerald-700", grad: "from-emerald-500 to-teal-600", dot: "bg-emerald-500", soft: "bg-emerald-50" },
  "COMPUTER SCIENCE": { icon: "💻", badge: "bg-indigo-100 text-indigo-700", grad: "from-indigo-500 to-blue-600", dot: "bg-indigo-500", soft: "bg-indigo-50" },
  NEWSLETTER: { icon: "📰", badge: "bg-orange-100 text-orange-700", grad: "from-orange-500 to-amber-600", dot: "bg-orange-500", soft: "bg-orange-50" },
};
const DEFAULT_STYLE: SubjectStyle = { icon: "📚", badge: "bg-gray-100 text-gray-700", grad: "from-slate-500 to-gray-600", dot: "bg-gray-400", soft: "bg-gray-50" };
const styleFor = (s: string) => SUBJECTS[s.toUpperCase()] ?? DEFAULT_STYLE;
const prettySubject = (s: string) => {
  if (s.toUpperCase() === "E.V.S") return "EVS";
  if (s.toUpperCase() === "NEWSLETTER") return "Newsletter";
  return s.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
};

// Cross-cutting filters (span subjects)
const PRACTICE_KEY = "__practice__";
const NEWSLETTER_KEY = "__newsletter__";
const isPracticePaper = (r: Resource) =>
  /practice\s*paper/i.test(r.title) || r.media.some((m) => /practicepaper/i.test(m.file));
const isNewsletter = (r: Resource) =>
  (r.category || "").toUpperCase() === "NEWSLETTER" || r.subject.toUpperCase() === "NEWSLETTER";

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
function mediaLabel(file: string, type: string, idx: number, total: number, isNl = false): string {
  if (type === "I") return "Image";
  if (isNl || /newsletter/i.test(file)) return "View Newsletter";
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
  const nl = isNewsletter(res);
  const isNew = today !== '' && daysBetween(res.date, today) >= 0 && daysBetween(res.date, today) <= 3;

  return (
    <div className="bg-white rounded-2xl border border-[var(--sp-border)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--sp-ink)] text-sm leading-snug">{res.title}</h3>
          {isNew ? (
            <span className="shrink-0 text-[10px] font-semibold text-[var(--sp-primary)] bg-[var(--sp-primary-soft)] px-1.5 py-0.5 rounded">
              New
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--sp-muted)]">
            {prettySubject(res.subject)}
          </span>
          <span className="sp-meta">{formatDateShort(res.date)}</span>
          {res.section ? <span className="sp-meta">{res.section}</span> : null}
        </div>

        {res.description ? (
          <p
            onClick={() => setExpanded((e) => !e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v);
            }}
            role="button"
            tabIndex={0}
            className={`mt-1.5 text-sm text-[var(--sp-muted)] leading-relaxed cursor-pointer ${expanded ? '' : 'line-clamp-2'}`}
          >
            {res.description}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap gap-2">
          {res.media.map((m, i) => {
            const isImg = m.type === 'I';
            return (
              <a
                key={i}
                href={mediaHref(m)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sp-border)] text-[11px] font-semibold text-[var(--sp-ink)] hover:border-orange-200 hover:bg-[var(--sp-primary-soft)] transition-colors"
              >
                {mediaLabel(m.file, m.type, i, res.media.length, nl || isImg)}
              </a>
            );
          })}
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

  // Subject list with counts (sorted by count desc); exclude newsletter (own filter chip)
  const subjectCounts = useMemo(() => {
    const c = new Map<string, number>();
    resources.forEach((r) => {
      if (isNewsletter(r)) return;
      c.set(r.subject, (c.get(r.subject) ?? 0) + 1);
    });
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const practiceCount = useMemo(() => resources.filter(isPracticePaper).length, []);
  const newsletterCount = useMemo(() => resources.filter(isNewsletter).length, []);

  // Months present (desc)
  const months = useMemo(() => Array.from(new Set(resources.map((r) => monthKey(r.date)))).sort((a, b) => b.localeCompare(a)), []);

  const totalFiles = useMemo(() => resources.reduce((a, r) => a + r.media.length, 0), []);

  // Filtered set
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => {
        if (activeSubject === PRACTICE_KEY) {
          if (!isPracticePaper(r)) return false;
        } else if (activeSubject === NEWSLETTER_KEY) {
          if (!isNewsletter(r)) return false;
        } else if (activeSubject !== "All" && r.subject !== activeSubject) return false;
        if (activeMonth !== "All" && monthKey(r.date) !== activeMonth) return false;
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          prettySubject(r.subject).toLowerCase().includes(q) ||
          (r.monthLabel || "").toLowerCase().includes(q) ||
          (r.grade || "").toLowerCase().includes(q)
        );
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
    <main className="sp-page">
      <header className="mb-5">
        <h1 className="sp-title">Library</h1>
        <p className="sp-subtitle">
          Worksheets, revision papers, and newsletters — {resources.length} resources.
        </p>
      </header>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, subject, or keyword"
          className="w-full rounded-xl border border-[var(--sp-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--sp-ink)] placeholder:text-[var(--sp-subtle)] sp-focus"
        />
      </div>

      {/* ── Subject filter ── */}
      <div className="mt-1">
        <p className="sp-section mb-1.5 px-1">Subject</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveSubject("All")}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeSubject === "All" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            🗂️ All · {resources.length}
          </button>
          <button
            onClick={() => setActiveSubject(NEWSLETTER_KEY)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              activeSubject === NEWSLETTER_KEY
                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
            }`}
          >
            📰 Newsletters · {newsletterCount}
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
        {activeSubject === NEWSLETTER_KEY
          ? " · Newsletters"
          : activeSubject === PRACTICE_KEY
            ? " · Practice Papers"
            : activeSubject !== "All" && ` · ${prettySubject(activeSubject)}`}
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

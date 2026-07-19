"use client";

import { useMemo, useState } from "react";
import diaryData from "@/data/info/class-diary.json";

type ResourceLink = { label: string; url: string };
type Resource = {
  id: string;
  title: string;
  subject: string;
  date: string;
  description: string;
  links: ResourceLink[];
};

const SUBJECT_STYLES: Record<string, { badge: string; icon: string }> = {
  English: { badge: "bg-sky-100 text-sky-700", icon: "📖" },
  Hindi: { badge: "bg-rose-100 text-rose-700", icon: "🪷" },
  Kannada: { badge: "bg-amber-100 text-amber-700", icon: "🏛️" },
  Mathematics: { badge: "bg-violet-100 text-violet-700", icon: "🔢" },
  EVS: { badge: "bg-emerald-100 text-emerald-700", icon: "🌿" },
  "Computer Science": { badge: "bg-indigo-100 text-indigo-700", icon: "💻" },
};

const subjectStyle = (subject: string) =>
  SUBJECT_STYLES[subject] ?? { badge: "bg-gray-100 text-gray-700", icon: "📝" };

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function PdfThumb() {
  return (
    <div className="relative w-14 h-16 sm:w-16 sm:h-20 shrink-0 rounded-lg border-2 border-red-200 bg-white shadow-sm flex flex-col items-center justify-center">
      <div className="absolute top-0 right-0 w-4 h-4 bg-red-100 rounded-bl-lg border-l-2 border-b-2 border-red-200" />
      <span className="text-xl sm:text-2xl">📄</span>
      <span className="text-[9px] sm:text-[10px] font-black text-red-500 tracking-wider">
        PDF
      </span>
    </div>
  );
}

function ResourceCard({ res }: { res: Resource }) {
  const style = subjectStyle(res.subject);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex gap-4">
      <PdfThumb />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-gray-800 text-sm sm:text-base leading-snug">
          {res.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
          >
            {style.icon} {res.subject}
          </span>
          <span className="text-[11px] sm:text-xs text-gray-400 font-medium">
            {new Date(res.date + "T00:00:00").toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-500 line-clamp-2">
          {res.description}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {res.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] sm:text-xs font-semibold hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            >
              <span>📎</span> {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClassDiaryPage() {
  const resources = diaryData.resources as Resource[];
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [search, setSearch] = useState("");

  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(resources.map((r) => r.subject)))],
    [resources]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (subjectFilter !== "All" && r.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [resources, subjectFilter, search]);

  const byDate = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    for (const r of filtered) {
      const list = groups.get(r.date) ?? [];
      list.push(r);
      groups.set(r.date, list);
    }
    return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      {/* Neverskip-style header bar */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📔</span>
          <h1 className="text-lg sm:text-xl font-bold tracking-wide uppercase">
            Class Diary — Content Library
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-purple-100">
          School resources from the parent portal, organised by subject and
          date. Tap a link to open the PDF.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search resources…"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {subjects.map((s) => {
            const active = subjectFilter === s;
            const icon = s === "All" ? "🗂️" : subjectStyle(s).icon;
            return (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-colors ${
                  active
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-purple-50"
                }`}
              >
                {icon} {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date-wise groups */}
      {byDate.length === 0 ? (
        <div className="mt-10 text-center text-gray-400 text-sm">
          No resources match your search.
        </div>
      ) : (
        byDate.map(([date, items]) => (
          <section key={date} className="mt-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xs sm:text-sm font-bold text-purple-700 uppercase tracking-wider whitespace-nowrap">
                📅 {formatDate(date)}
              </h2>
              <div className="h-px flex-1 bg-purple-100" />
              <span className="text-[10px] sm:text-xs font-semibold text-gray-400 whitespace-nowrap">
                {items.length} {items.length === 1 ? "resource" : "resources"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((res) => (
                <ResourceCard key={res.id} res={res} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="mt-8 text-center text-[11px] text-gray-400">
        Source: {diaryData.source} · Last synced {diaryData.lastSynced}
      </p>
    </main>
  );
}

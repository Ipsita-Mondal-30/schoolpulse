"use client";

import { useState, useEffect, Suspense } from "react";
import { fetchHomework, Homework } from "../actions";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

import { useUpdates } from "@/context/UpdatesContext";
import HomeworkShareButton from "@/components/HomeworkShareButton";

function HomeworkContent() {
  const { updates, loading, refreshUpdates } = useUpdates();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter homework from the global updates context
  const homeworkList: Homework[] = updates
    .filter(
      (u) =>
        u.category?.toLowerCase().includes("homework") || u.type === "homework",
    )
    .map((u) => ({
      id: `hw-${u.id}`,
      status: "Active",
      subject: (u.title || "General")
        .replace(/^home\s*work\s*-\s*/i, "")
        .trim(),
      content: u.message,
      submissionDate: u.expiresAt,
      notes: u.link ? `Link: ${u.link}` : "",
      createdAt: u.createdAt,
    }));

  const handleRefresh = async () => {
    // router.replace('/homework?refresh=' + Date.now()); // No longer needed for data refresh
    await refreshUpdates();
  };

  const getSubjectColor = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes("math") || s.includes("numeracy"))
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (s.includes("english") || s.includes("literacy"))
      return "bg-green-100 text-green-800 border-green-200";
    if (s.includes("kannada"))
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (s.includes("evs") || s.includes("science"))
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s.includes("art") || s.includes("craft"))
      return "bg-pink-100 text-pink-800 border-pink-200";
    if (s.includes("hindi"))
      return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  };

  const getDueDateStatus = (dateStr: string) => {
    if (!dateStr) return null;

    // Create 'today' at local midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse 'due' string (YYYY-MM-DD) into local midnight
    // new Date("YYYY-MM-DD") often parses as UTC, which causes timezone shifts.
    // Constructing with (y, m, d) forces local time.
    const [year, month, day] = dateStr.split("-").map(Number);
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);

    if (isNaN(due.getTime())) return null;

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0)
      return {
        label: "Overdue",
        color: "bg-red-100 text-red-700 border-red-200",
      };
    if (diffDays === 0)
      return {
        label: "Due Today",
        color: "bg-orange-100 text-orange-700 border-orange-200",
      };
    if (diffDays === 1)
      return {
        label: "Due Tomorrow",
        color: "bg-amber-100 text-amber-700 border-amber-200",
      };

    // Format regular due date
    const d = due.getDate();
    const m = due.toLocaleString("default", { month: "short" });
    return {
      label: `Due: ${d} ${m}`,
      color: "bg-blue-50 text-blue-600 border-blue-100",
    };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">📚</span>
          Homework Tracker
        </h1>
        <div className="flex items-center gap-3">
          <HomeworkShareButton homeworkList={homeworkList} />
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-orange-500 transition-colors rounded-full hover:bg-orange-50"
            title="Refresh Homework"
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-500 animate-pulse">
            Checking for homework...
          </p>
        </div>
      ) : homeworkList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="text-6xl mb-4 opacity-50">📝</div>
          <p className="text-xl text-gray-500 font-medium">
            No active homework assignments found.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Check back later for updates!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {homeworkList.map((hw) => {
            const status = getDueDateStatus(hw.submissionDate);
            return (
              <div
                key={hw.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${getSubjectColor(hw.subject).split(" ")[0].replace("bg-", "bg-")}`}
                ></div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${getSubjectColor(hw.subject)}`}
                    >
                      {hw.subject}
                    </span>
                    {status && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${status.color}`}
                      >
                        <span>🕒</span> {status.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-gray-800 mb-3 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 text-base">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                    {hw.content}
                  </ReactMarkdown>
                </div>

                {hw.notes && (
                  <div className="bg-gray-50 rounded-xl p-4 mt-4 border border-gray-100">
                    <p className="text-sm text-gray-600 italic flex gap-2">
                      <span className="text-gray-400 not-italic">📝</span>
                      {hw.notes}
                    </p>
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

export default function HomeworkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-500 animate-pulse">
            Loading homework tracker...
          </p>
        </div>
      }
    >
      <HomeworkContent />
    </Suspense>
  );
}

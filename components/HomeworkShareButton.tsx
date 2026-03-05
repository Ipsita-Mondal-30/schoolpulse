"use client";

import { Homework } from "@/app/actions";

interface HomeworkShareButtonProps {
  homeworkList: Homework[];
  className?: string;
}

export default function HomeworkShareButton({
  homeworkList,
  className = "",
}: HomeworkShareButtonProps) {
  const generateShareText = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let text = `📅 *Homework Update - ${dateStr}*\n\n`;

    if (homeworkList.length === 0) {
      text += `No active homework assignments right now! 🎉\n\n`;
    } else {
      homeworkList.forEach((hw, index) => {
        text += `📚 *${hw.subject?.toUpperCase() || "GENERAL"}*\n`;
        text += `📝 ${hw.content}\n`;
        if (hw.notes) {
          text += `🔗 ${hw.notes}\n`;
        }

        const dueStatus = getDueDateStatusText(hw.submissionDate);
        if (dueStatus) {
          text += `🕒 ${dueStatus}\n`;
        }
        text += `\n`;
      });
    }

    text += `_via SchoolPulse_ 💓`;
    return text;
  };

  const getDueDateStatusText = (dateStr?: string) => {
    if (!dateStr) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dateStr.split("-").map(Number);
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);

    if (isNaN(due.getTime())) return null;

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";

    const d = due.getDate();
    const m = due.toLocaleString("en-IN", { month: "short" });
    return `Due: ${d} ${m}`;
  };

  const shareViaWhatsApp = () => {
    const text = generateShareText();
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const shareNative = async () => {
    const text = generateShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Homework Update`,
          text: text,
        });
      } catch (err: any) {
        // User cancelled or error - fallback to WhatsApp
        if (err.name !== "AbortError") {
          shareViaWhatsApp();
        }
      }
    } else {
      shareViaWhatsApp();
    }
  };

  return (
    <button
      onClick={shareNative}
      className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium shadow-sm ${className}`}
      title="Share Homework"
    >
      <svg
        className="w-4 h-4 md:w-5 md:h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span className="hidden sm:inline">Share</span>
    </button>
  );
}

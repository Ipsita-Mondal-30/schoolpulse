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
    // Helper to unpack date metadata
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

    const todayStr = "2026-06-12"; // matches context active today date representation
    
    // Filter to include only today's homework
    const todaysHw = homeworkList.filter(hw => {
      const { assigned } = getHwMeta(hw);
      return assigned === todayStr;
    });

    const todayObj = new Date(2026, 5, 12); // June 12, 2026
    const dateFormatted = todayObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    let text = `📝 *Homework Updates - ${dateFormatted}*\n\n`;

    if (todaysHw.length === 0) {
      text += `No new homework assignments assigned today! 🎉\n\n`;
    } else {
      todaysHw.forEach((hw) => {
        const { chapter } = getHwMeta(hw);
        text += `*${hw.subject?.toUpperCase() || "GENERAL"}*`;
        if (chapter) {
          text += ` (${chapter})`;
        }
        text += `\n`;
        text += `${hw.content}\n`;
        if (hw.submissionDate) {
          text += `⏰ *Due Date:* ${hw.submissionDate}\n`;
        }
        text += `---------------------------\n\n`;
      });
    }

    text += `👉 *View past days' homework online:* https://schoolpulse-six.vercel.app/homework\n`;
    text += `💓 _via SchoolPulse_`;
    return text;
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

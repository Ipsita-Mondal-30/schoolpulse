"use client";

import { DaySchedule, formatDate } from "@/lib/data";

interface ShareButtonProps {
  day: DaySchedule;
  className?: string;
}

export default function ShareButton({ day, className = "" }: ShareButtonProps) {
  const generateShareText = () => {
    // Custom share for Day 1 Reopening
    if (day.date === "2026-05-21") {
      return `🏫 *Class 1 Reopening - BGSNPS*\n📅 *${formatDate(day.date)}*\n\n` +
             `*Glimpse of Day 1:*\n` +
             `📍 *Timings:* Report by 7:50 AM\n` +
             `📚 *Books:* English, Maths, EVS, Value Ed, Art, Cursive, Hindi TBs\n` +
             `🛍️ *Uniform Shop:* Shifted to new Jayanagar address\n\n` +
             `For complete Day 1 rules, homework policies, and pick-up logistics, tap the link below!\n\n` +
             `_via SchoolPuls_ 💓\n🔗 https://www.schoolpuls.in/`;
    }

    // Temporarily disabled default schedule dump for a few days to drive app traffic
    return `🏫 *SchoolPuls - Class 1 Planner*\n📅 *${formatDate(day.date)}*\n\nTap the link below to view today's complete schedule, homework updates, and important notices!\n\n_via SchoolPuls_ 💓\n🔗 https://www.schoolpuls.in/`;
  };

  const getSubjectEmoji = (subject: string): string => {
    const emojiMap: Record<string, string> = {
      LITERACY: "📚",
      NUMERACY: "🔢",
      KANNADA: "🇮🇳",
      HINDI: "📝",
      "GENERAL AWARENESS": "🌍",
      STORY: "📖",
      ART: "🎨",
      "Prayer/Rhymes": "🙏",
      "General Assembly": "🎤",
      "SOCIO EMOTIONAL": "💝",
    };

    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (subject.toUpperCase().includes(key.toUpperCase())) {
        return emoji;
      }
    }
    return "📌";
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
          title: `Schedule for ${formatDate(day.date)}`,
          text: text,
        });
      } catch (err) {
        // User cancelled or error - fallback to WhatsApp
        shareViaWhatsApp();
      }
    } else {
      shareViaWhatsApp();
    }
  };

  return (
    <button
      onClick={shareNative}
      className={`flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium ${className}`}
    >
      <svg
        className="w-5 h-5"
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
      Share
    </button>
  );
}

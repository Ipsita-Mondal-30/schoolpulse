"use client";

import { DaySchedule, formatDate } from "@/lib/data";

interface ShareButtonProps {
  day: DaySchedule;
  className?: string;
}

export default function ShareButton({ day, className = "" }: ShareButtonProps) {
  const generateShareText = () => {
    if (day.isHoliday) {
      return `📅 *${formatDate(day.date)}*\n\n🎉 *${day.holidayName}*\nSchool Holiday\n\n_via SchoolPuls_ 💓\n🔗 https://www.schoolpuls.in/`;
    }

    let text = `📅 *${formatDate(day.date)}*\n\n`;
    text += `🏫 *Today's Schedule*\n\n`;

    for (const item of day.schedule) {
      if (item.subject === "Snack Break") {
        text += `☕ ${item.time} - Break\n`;
      } else if (item.subject === "Meditation") {
        text += `🧘 ${item.time} - Meditation\n`;
      } else {
        const emoji = getSubjectEmoji(item.subject);
        text += `${emoji} ${item.time} - *${item.subject}*`;
        if (item.activity) {
          text += `\n   _${item.activity}_`;
        }
        text += "\n";
      }
    }

    text += `\n_via SchoolPuls_ 💓\n🔗 https://www.schoolpuls.in/`;
    return text;
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

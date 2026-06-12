'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUpdates } from '@/context/UpdatesContext';

export default function Navigation() {
  const pathname = usePathname();
  const { homeworkCount } = useUpdates();

  const links = [
    { href: '/', label: 'Planner', icon: '📋' },
    { href: '/week', label: 'Kids Quest', icon: '🎮' },
    { href: '/homework', label: 'Homework', icon: '📚' },
    { href: '/info', label: 'Info', icon: 'ℹ️' },
    { href: '/dates', label: 'Events', icon: '🔔' },
    { href: '/month', label: 'Month', icon: '🗓️' },
    // { href: '/admin', label: 'Admin', icon: '⚙️' },
  ];

  const triggerMorningAlert = () => {
    const today = new Date();
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
    alert(`⏰ Daily Prep Digest - ${weekday}\n\n☀️ Uniform: Wear regular school uniform today.\n🎒 Bag Prep: Pack EVS Textbook & Workbook.\n🚌 Transport: School bus scheduled for 08:15 AM.\n📝 Homework: Check active homework timeline tab.`);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Link href="/showcase.html" className="flex items-center gap-1">
              <span className="text-xl sm:text-2xl">💓</span>
              <span className="font-bold text-orange-600 text-sm sm:text-base">SchoolPuls</span>
            </Link>
            {/* Alarm Button inside navigation header */}
            <button
              onClick={triggerMorningAlert}
              className="flex items-center justify-center w-[30px] h-[30px] bg-rose-50 border border-rose-100 text-rose-600 rounded-full hover:bg-rose-100 transition-all shadow-sm active:scale-90"
              title="Daily Prep Alarm"
              aria-label="Daily Prep Alarm"
            >
              <span className="text-sm">⏰</span>
            </button>
          </div>
          <div className="flex items-center gap-0 sm:gap-1 w-auto justify-end sm:justify-start">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-1 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {/* Badge for Homework */}
                  {link.label === 'Homework' && homeworkCount > 0 && (
                    <span className="absolute top-1 right-1 sm:-top-1 sm:-right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                      {homeworkCount}
                    </span>
                  )}

                  {/* Mobile: Icon + Small Text */}
                  <div className="sm:hidden flex flex-col items-center gap-0.5">
                    <span className="text-lg">{link.icon}</span>
                    <span className="text-[10px] leading-none">{link.label}</span>
                  </div>
                  {/* Desktop: Text Only */}
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav >
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUpdates } from '@/context/UpdatesContext';
import RecentUpdates from './RecentUpdates';

export default function Navigation() {
  const pathname = usePathname();
  const { homeworkCount } = useUpdates();

  const links = [
    { href: '/', label: 'Planner', icon: '📋' },
    { href: '/week', label: 'Kids Quest', icon: '🎮' },
    { href: '/homework', label: 'Homework', icon: '📚' },
    { href: '/info', label: 'Info', icon: 'ℹ️' },
    { href: '/dates', label: 'Events', icon: '🔔' },
    { href: '/month', label: 'Revision', icon: '📝' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 flex flex-col">
      {/* Header Row */}
      <div className="max-w-4xl mx-auto w-full px-4 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1">
            <span className="text-xl sm:text-2xl">💓</span>
            <span className="font-bold text-orange-600 text-sm sm:text-base">SchoolPuls</span>
          </Link>
        </div>

        {/* Right: Links (Desktop) & RecentUpdates (All devices) */}
        <div className="flex items-center gap-4">
          {/* Desktop Links (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {link.label === 'Homework' && homeworkCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                      {homeworkCount}
                    </span>
                  )}
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Global RecentUpdates (Alarm + Updates Bell) */}
          <RecentUpdates />
        </div>
      </div>

      {/* Mobile Scrollable Tabs Bar (hidden on desktop, scrollable on mobile) */}
      <div className="sm:hidden w-full border-t border-gray-100 overflow-x-auto whitespace-nowrap bg-gray-50/50 py-2 px-3 flex gap-1.5 items-center scrollbar-none">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 ${
                isActive
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-150'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
              {link.label === 'Homework' && homeworkCount > 0 && (
                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm ring-1 ring-white animate-pulse">
                  {homeworkCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

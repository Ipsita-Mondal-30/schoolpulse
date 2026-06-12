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
    { href: '/month', label: 'Month', icon: '🗓️' },
  ];

  return (
    <>
      {/* Top Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 h-14">
        <div className="max-w-4xl mx-auto px-4 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Brand */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-1">
                <span className="text-xl sm:text-2xl">💓</span>
                <span className="font-bold text-orange-600 text-sm sm:text-base">SchoolPuls</span>
              </Link>
            </div>

            {/* Right: Links (Desktop) & RecentUpdates (All devices) */}
            <div className="flex items-center gap-4">
              {/* Desktop links */}
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
        </div>
      </nav>

      {/* Bottom Navigation Bar (Mobile only) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg h-16 safe-bottom">
        <div className="grid grid-cols-6 h-full">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-orange-600' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <span className="text-lg">{link.icon}</span>
                  {link.label === 'Homework' && homeworkCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm ring-1 ring-white animate-pulse">
                      {homeworkCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold tracking-tight">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

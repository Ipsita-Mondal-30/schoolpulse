'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useUpdates } from '@/context/UpdatesContext';
import {
  getUpcomingEvents,
  getTodayEvent,
  formatShortDate,
  Announcement
} from '@/lib/data';

interface Update extends Announcement {
  isExternal?: boolean;
}

export default function RecentUpdates() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  // Use Context
  const { updates: externalUpdates, loading } = useUpdates();

  const updates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];



    // 2. Get today's events from lib/data.ts (System events)
    const todayEvent = getTodayEvent();
    const todayEventUpdate: Update[] = todayEvent ? [{
      id: 9000,
      createdAt: todayEvent.date,
      title: 'EVENT TODAY',
      message: `${todayEvent.event}: ${todayEvent.description}`,
      type: 'urgent',
      priority: 1,
      category: 'EVENT',
      expiresAt: todayEvent.date
    }] : [];

    // 3. Get upcoming events from lib/data.ts (System events)
    const upcomingEvents = getUpcomingEvents(3);
    const eventUpdates: Update[] = upcomingEvents
      .filter(e => e.date !== today)
      .map((e, idx) => ({
        id: 7000 + idx,
        createdAt: e.date,
        title: 'UPCOMING EVENT',
        message: `${formatShortDate(e.date)}: ${e.event}`,
        type: e.type === 'holiday' ? 'holiday' : 'info',
        priority: 2,
        category: 'EVENT',
        link: '',
        linkText: '',
        expiresAt: e.date
      }));

    // Combine all updates
    const allUpdates = [...todayEventUpdate, ...externalUpdates, ...eventUpdates]
      .filter(u => !u.category?.toLowerCase().includes('homework') && !u.category?.toLowerCase().includes('home work') && u.type !== 'homework') // Exclude homework from notifications
      .sort((a, b) => {
        // Sort by priority (1 is highest)
        if (a.priority !== b.priority) return (a.priority || 3) - (b.priority || 3);
        // Then by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return allUpdates;
  }, [externalUpdates]);

  useEffect(() => {
    // Check for new updates
    const lastSeen = localStorage.getItem('updates_last_seen');
    if (updates.length > 0) {
      const latestUpdate = updates[0];
      if (!lastSeen || lastSeen < latestUpdate.createdAt) {
        setHasNew(true);
      }
    }
  }, [updates]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNew(false);
    localStorage.setItem('updates_last_seen', new Date().toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getTypeStyle = (type: string, priority?: number) => {
    if (priority === 1) return 'bg-white border-orange-500 shadow-lg border-2 ring-4 ring-orange-50';
    switch (type) {
      case 'urgent':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'holiday':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'notice':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'homework':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const triggerMorningAlert = () => {
    const today = new Date();
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });
    // Mock prep notification context matches user's request details
    alert(`⏰ Daily Prep Digest - ${weekday}\n\n☀️ Uniform: Wear regular school uniform today.\n🎒 Bag Prep: Pack EVS Textbook & Workbook.\n🚌 Transport: School bus scheduled for 08:15 AM.\n📝 Homework: Check active homework timeline tab.`);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Morning Prep Digest Quick Button */}
        <button
          onClick={triggerMorningAlert}
          className="relative flex items-center justify-center w-[34px] h-[34px] bg-rose-50 border border-rose-100 text-rose-600 rounded-full hover:bg-rose-100 transition-all shadow-sm"
          aria-label="Daily Prep Digest"
          title="Daily Prep Digest"
        >
          <span className="text-sm">⏰</span>
        </button>

        {/* Updates Button */}
        <button
          onClick={handleOpen}
          className="relative flex items-center justify-center w-[34px] h-[34px] bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-all shadow-sm"
          aria-label="Updates"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {updates.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
              {updates.length}
            </span>
          )}
        </button>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Content */}
          <div className="relative bg-white w-full sm:w-96 max-h-[70vh] rounded-t-2xl sm:rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-orange-50/50">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Updates
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Updates List */}
            <div className="p-2 sm:p-3 overflow-y-auto max-h-[65vh]">
              {updates.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-6 font-medium">No updates at the moment</p>
              ) : (
                <div className="space-y-4">
                  {/* Category Grouping Logic */}
                  {[
                    { title: 'Urgent Action / High Priority', items: updates.filter(u => u.category?.toLowerCase().includes('urgent')) },
                    // { title: 'Home Work / Daily Tasks', items: updates.filter(u => u.category?.toLowerCase().includes('home') || u.category?.toLowerCase().includes('homework')) },
                    { title: 'School Actions & Notices', items: updates.filter(u => u.category?.toLowerCase().includes('school')) },
                    { title: 'Holidays & Closures', items: updates.filter(u => u.category?.toLowerCase().includes('holiday')) },
                    { title: 'Upcoming Events', items: updates.filter(u => u.category?.toLowerCase().includes('event')) },
                    { title: 'General Information', items: updates.filter(u => !['urgent', 'home', 'homework', 'school', 'holiday', 'event'].some(k => u.category?.toLowerCase().includes(k))) },
                  ]
                    .filter(group => group.items.length > 0)
                    .map((group, gIdx) => (
                      <div key={gIdx} className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                          {group.title}
                        </h4>
                        <div className="space-y-2">
                          {group.items.map((update) => (
                            <div
                              key={update.id}
                              className={`p-2.5 rounded-lg border transition-all duration-300 ${getTypeStyle(update.type, update.priority)}`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex flex-col min-w-0">
                                  <h3 className="font-bold text-[13px] leading-snug">{update.title}</h3>
                                </div>
                              </div>
                              <p className="text-[12px] mt-1 opacity-80 leading-relaxed font-medium">
                                {update.message}
                              </p>
                              {update.link && (
                                update.link.startsWith('/') ? (
                                  <Link
                                    href={update.link}
                                    className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-md hover:bg-orange-600 transition-all shadow-sm shadow-orange-100 uppercase tracking-wide"
                                  >
                                    {update.linkText || 'View Details'}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                  </Link>
                                ) : (
                                  <a
                                    href={update.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-md hover:bg-orange-600 transition-all shadow-sm shadow-orange-100 uppercase tracking-wide"
                                  >
                                    {update.linkText || 'Learn More'}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

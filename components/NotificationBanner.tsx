'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUpdates } from '@/context/UpdatesContext';
import {
  getUpcomingEvents,
  getTodayEvent,
  formatShortDate,
  ImportantDate,
} from '@/lib/data';

interface BannerItem {
  message: string;
  type: 'info' | 'warning' | 'holiday' | 'important' | 'event' | 'activity' | 'urgent' | 'notice';
  isToday?: boolean;
}

export default function NotificationBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Consume the context
  const { updates: externalUpdates } = useUpdates();

  // Re-calculate banner items whenever updates change
  const bannerItems = useMemo(() => {
    const items: BannerItem[] = [];

    // Check for today's event first (highest priority)
    const todayEvent = getTodayEvent();
    if (todayEvent) {
      items.push({
        message: `TODAY: ${todayEvent.event} - ${todayEvent.description}`,
        type: todayEvent.type,
        isToday: true,
      });
    }

    // Add external updates (from Context)
    for (const a of externalUpdates) {
      items.push({
        message: a.message,
        type: a.type as any,
      });
    }

    // Add upcoming events (next 3 days) if not already today
    const upcomingEvents = getUpcomingEvents(3);
    for (const event of upcomingEvents) {
      // Skip if it's today's event (already added)
      if (todayEvent && event.date === todayEvent.date) continue;

      const daysUntil = Math.ceil(
        (new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      let prefix = '';
      if (daysUntil === 1) {
        prefix = 'TOMORROW: ';
      } else if (daysUntil === 2) {
        prefix = 'In 2 days: ';
      } else {
        prefix = `${formatShortDate(event.date)}: `;
      }

      items.push({
        message: `${prefix}${event.event}`,
        type: event.type,
      });
    }

    return items;
  }, [externalUpdates]);

  useEffect(() => {
    if (bannerItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [bannerItems.length]);

  if (bannerItems.length === 0) return null;

  const current = bannerItems[currentIndex];

  const typeStyles: Record<string, string> = {
    info: 'bg-sky-500',
    warning: 'bg-orange-400',
    holiday: 'bg-rose-400',
    important: 'bg-fuchsia-500',
    event: 'bg-cyan-500',
    activity: 'bg-lime-500',
    urgent: 'bg-red-600',
    notice: 'bg-indigo-500',
  };

  const typeIcons: Record<string, string> = {
    info: '📢',
    warning: '⚠️',
    holiday: '🎉',
    important: '❗',
    event: '📅',
    activity: '🎨',
    urgent: '🚨',
    notice: '📝',
  };

  return (
    <div className={`${typeStyles[current.type]} text-white py-2 px-4 ${current.isToday ? 'animate-pulse' : ''}`}>
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
        <span className="text-lg">{typeIcons[current.type]}</span>
        <span className="font-medium text-sm sm:text-base">{current.message}</span>
        {bannerItems.length > 1 && (
          <span className="ml-2 text-xs opacity-75">
            ({currentIndex + 1}/{bannerItems.length})
          </span>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useUpdates } from '@/context/UpdatesContext';
import {
  getUpcomingEvents,
  getTodayEvent,
  formatShortDate,
  Announcement,
} from '@/lib/data';

interface Update extends Announcement {
  isExternal?: boolean;
}

function toneClasses(type: string, priority?: number) {
  if (priority === 1) {
    return 'border-orange-200 bg-[var(--sp-primary-soft)] text-[var(--sp-ink)]';
  }
  switch (type) {
    case 'urgent':
      return 'border-red-100 bg-[var(--sp-error-soft)] text-[var(--sp-error)]';
    case 'holiday':
      return 'border-emerald-100 bg-[var(--sp-success-soft)] text-[var(--sp-success)]';
    case 'notice':
      return 'border-orange-100 bg-[var(--sp-primary-soft)] text-[var(--sp-primary)]';
    default:
      return 'border-[var(--sp-border)] bg-[var(--sp-bg)] text-[var(--sp-ink)]';
  }
}

export default function RecentUpdates() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { updates: externalUpdates } = useUpdates();

  const updates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    const todayEvent = getTodayEvent();
    const todayEventUpdate: Update[] = todayEvent
      ? [
          {
            id: 9000,
            createdAt: todayEvent.date,
            title: 'Event today',
            message: `${todayEvent.event}: ${todayEvent.description}`,
            type: 'urgent',
            priority: 1,
            category: 'EVENT',
            expiresAt: todayEvent.date,
          },
        ]
      : [];

    const upcomingEvents = getUpcomingEvents(3);
    const eventUpdates: Update[] = upcomingEvents
      .filter((e) => e.date !== today)
      .map((e, idx) => ({
        id: 7000 + idx,
        createdAt: e.date,
        title: 'Upcoming event',
        message: `${formatShortDate(e.date)}: ${e.event}`,
        type: e.type === 'holiday' ? 'holiday' : 'info',
        priority: 2,
        category: 'EVENT',
        link: '',
        linkText: '',
        expiresAt: e.date,
      }));

    return [...todayEventUpdate, ...externalUpdates, ...eventUpdates]
      .filter(
        (u) =>
          !u.category?.toLowerCase().includes('homework') &&
          !u.category?.toLowerCase().includes('home work') &&
          u.type !== 'homework',
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return (a.priority || 3) - (b.priority || 3);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [externalUpdates]);

  useEffect(() => {
    const lastSeen = localStorage.getItem('updates_last_seen');
    if (updates.length > 0) {
      const latestUpdate = updates[0];
      if (!lastSeen || lastSeen < latestUpdate.createdAt) {
        setHasNew(true);
      }
    }
  }, [updates]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen((open) => !open);
    setHasNew(false);
    localStorage.setItem(
      'updates_last_seen',
      new Date().toISOString().split('T')[0],
    );
  };

  const groups = [
    {
      title: 'Urgent',
      items: updates.filter((u) => u.category?.toLowerCase().includes('urgent')),
    },
    {
      title: 'School notices',
      items: updates.filter((u) => u.category?.toLowerCase().includes('school')),
    },
    {
      title: 'Holidays',
      items: updates.filter((u) => u.category?.toLowerCase().includes('holiday')),
    },
    {
      title: 'Upcoming events',
      items: updates.filter((u) => u.category?.toLowerCase().includes('event')),
    },
    {
      title: 'General',
      items: updates.filter(
        (u) =>
          !['urgent', 'home', 'homework', 'school', 'holiday', 'event'].some((k) =>
            u.category?.toLowerCase().includes(k),
          ),
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--sp-border)] bg-white text-[var(--sp-muted)] transition-colors hover:bg-[var(--sp-primary-soft)] hover:text-[var(--sp-primary)] sp-focus"
        aria-label="Updates"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {updates.length > 0 ? (
          <span
            className={`absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
              hasNew ? 'bg-[var(--sp-error)]' : 'bg-[var(--sp-muted)]'
            }`}
          >
            {updates.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            aria-hidden
            onClick={() => setIsOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Updates"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-hidden rounded-t-2xl border border-[var(--sp-border)] bg-white shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:max-h-[min(70vh,28rem)] sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--sp-border)] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--sp-ink)]">Updates</h2>
                <p className="text-[11px] text-[var(--sp-subtle)]">
                  {updates.length} item{updates.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--sp-subtle)] hover:bg-[var(--sp-bg)] hover:text-[var(--sp-ink)] sp-focus"
                aria-label="Close updates"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 max-h-[calc(75vh-3.5rem)] sm:max-h-[min(62vh,24rem)]">
              {updates.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-[var(--sp-muted)]">
                  No updates right now
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sp-subtle)]">
                        {group.title}
                      </h3>
                      <div className="space-y-2">
                        {group.items.map((update) => (
                          <div
                            key={update.id}
                            className={`rounded-xl border px-3 py-2.5 ${toneClasses(update.type, update.priority)}`}
                          >
                            <h4 className="text-[13px] font-semibold leading-snug">
                              {update.title}
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed opacity-90">
                              {update.message}
                            </p>
                            {update.link ? (
                              update.link.startsWith('/') ? (
                                <Link
                                  href={update.link}
                                  onClick={() => setIsOpen(false)}
                                  className="mt-2 inline-flex text-[11px] font-semibold text-[var(--sp-primary)] hover:underline"
                                >
                                  {update.linkText || 'View details'}
                                </Link>
                              ) : (
                                <a
                                  href={update.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex text-[11px] font-semibold text-[var(--sp-primary)] hover:underline"
                                >
                                  {update.linkText || 'Learn more'}
                                </a>
                              )
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

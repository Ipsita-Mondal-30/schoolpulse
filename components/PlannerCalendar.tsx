'use client';

import { ImportantDate } from '@/lib/data';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const TYPE_DOT: Record<ImportantDate['type'], string> = {
  holiday: 'bg-red-500',
  event: 'bg-blue-500',
  activity: 'bg-amber-400',
  important: 'bg-orange-500',
};

const TYPE_LABEL: Record<ImportantDate['type'], string> = {
  holiday: 'Holiday',
  event: 'Event',
  activity: 'Assessment',
  important: 'Homework',
};

function toYMD(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function parseYMD(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

function formatUpcomingDate(dateStr: string): string {
  const { y, m, d } = parseYMD(dateStr);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatSelectedHeading(dateStr: string): string {
  const { y, m, d } = parseYMD(dateStr);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
  return `${d} ${month}`;
}

function buildCalendarCells(year: number, monthIndex: number) {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrev = new Date(year, monthIndex, 0).getDate();

  const cells: { date: string; day: number; inMonth: boolean }[] = [];

  for (let i = firstDow - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const prev = monthIndex === 0 ? { y: year - 1, m: 11 } : { y: year, m: monthIndex - 1 };
    cells.push({ date: toYMD(prev.y, prev.m, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toYMD(year, monthIndex, day), day, inMonth: true });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    const next = monthIndex === 11 ? { y: year + 1, m: 0 } : { y: year, m: monthIndex + 1 };
    cells.push({ date: toYMD(next.y, next.m, day), day, inMonth: false });
  }

  return cells;
}

interface PlannerCalendarProps {
  month: string;
  year: number;
  dates: ImportantDate[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function PlannerCalendar({
  month,
  year,
  dates,
  selectedDate,
  onSelectDate,
  canGoPrev,
  canGoNext,
  onPrevMonth,
  onNextMonth,
}: PlannerCalendarProps) {
  const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
  const cells = buildCalendarCells(year, monthIndex);

  const eventsByDate = new Map<string, ImportantDate[]>();
  for (const item of dates) {
    const list = eventsByDate.get(item.date) || [];
    list.push(item);
    eventsByDate.set(item.date, list);
  }

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : [];

  const upcoming = selectedDate
    ? dates.filter((d) => d.date >= selectedDate).slice(0, 8)
    : dates.slice(0, 8);

  const legendTypes = (['holiday', 'event', 'activity', 'important'] as const).filter((t) =>
    dates.some((d) => d.type === t)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.75rem] font-bold tracking-tight text-[var(--sp-ink)] sm:text-[2rem]">
            Planner
          </h1>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">
            {month} {year}
          </p>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sp-border)] bg-white text-[var(--sp-muted)] transition-colors hover:bg-[var(--sp-bg)] disabled:opacity-30 sp-focus"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sp-border)] bg-white text-[var(--sp-muted)] transition-colors hover:bg-[var(--sp-bg)] disabled:opacity-30 sp-focus"
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--sp-border)] bg-white p-3 sm:p-4">
        <div className="mb-2 grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="py-1.5 text-center text-[11px] font-medium text-[var(--sp-subtle)]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayEvents = eventsByDate.get(cell.date) || [];
            const isSelected = selectedDate === cell.date;

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDate(cell.date)}
                className="relative flex flex-col items-center justify-start gap-1 py-2 sp-focus rounded-lg"
                aria-pressed={isSelected}
                aria-label={`${cell.date}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--sp-primary)] font-semibold text-white'
                      : cell.inMonth
                        ? 'font-medium text-[var(--sp-ink)]'
                        : 'text-gray-300'
                  }`}
                >
                  {cell.day}
                </span>
                <span className="flex h-1.5 min-h-1.5 items-center justify-center gap-0.5">
                  {dayEvents.slice(0, 3).map((ev, idx) => (
                    <span
                      key={`${ev.event}-${idx}`}
                      className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[ev.type] || TYPE_DOT.event}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <section className="space-y-2.5">
          <h2 className="sp-section tracking-[0.12em]">{formatSelectedHeading(selectedDate)}</h2>
          {selectedEvents.length > 0 ? (
            <div className="space-y-2">
              {selectedEvents.map((ev, idx) => (
                <div
                  key={`${ev.event}-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl bg-[var(--sp-primary-soft)] px-3.5 py-3"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[ev.type] || TYPE_DOT.event}`}
                  />
                  <span className="text-sm font-medium text-[var(--sp-ink)]">{ev.event}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--sp-border)] px-3.5 py-3 text-sm text-[var(--sp-muted)]">
              No important dates on this day
            </div>
          )}
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="space-y-2.5">
          <h2 className="sp-section tracking-[0.12em]">Upcoming</h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white">
            {upcoming.map((item, index) => (
              <button
                key={`${item.date}-${item.event}-${index}`}
                type="button"
                onClick={() => onSelectDate(item.date)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--sp-bg)] sp-focus ${
                  index > 0 ? 'border-t border-[var(--sp-border)]' : ''
                } ${selectedDate === item.date ? 'bg-[var(--sp-primary-soft)]' : ''}`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[item.type] || TYPE_DOT.event}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--sp-ink)]">
                  {item.event}
                </span>
                <span className="shrink-0 text-sm text-[var(--sp-subtle)]">
                  {formatUpcomingDate(item.date)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {legendTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0.5 pb-1">
          {legendTypes.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT[type]}`} />
              <span className="text-xs text-[var(--sp-muted)]">{TYPE_LABEL[type]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

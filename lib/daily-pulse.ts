import timetableData from '@/data/timetable.json';
import { INDIA_TIME_ZONE } from '@/lib/daily-brief';

export type PulseMarker = {
  minutes: number;
  timeLabel: string;
  caption: string;
  kind: 'start' | 'now' | 'mid' | 'end';
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getIndiaMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function getIndiaWeekday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    weekday: 'long',
  }).format(now);
}

export function buildDailyPulse(now: Date = new Date()): {
  progress: number;
  markers: PulseMarker[];
  isWeekend: boolean;
} {
  const periods = timetableData.periods;
  const start = toMinutes(periods[0].startTime);
  const end = toMinutes(periods[periods.length - 1].endTime);
  const nowMin = getIndiaMinutes(now);
  const weekday = getIndiaWeekday(now);
  const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
  const span = Math.max(end - start, 1);
  const progress = isWeekend ? 0 : Math.min(1, Math.max(0, (nowMin - start) / span));

  const mid = periods.find((p) => p.type === 'break' && /lunch/i.test(p.label || '')) ||
    periods[Math.floor(periods.length / 2)];

  const markers: PulseMarker[] = [
    { minutes: start, timeLabel: formatHm(start), caption: 'School starts', kind: 'start' },
  ];

  if (!isWeekend && nowMin >= start && nowMin < end) {
    const current = periods.find((p) => {
      const s = toMinutes(p.startTime);
      const e = toMinutes(p.endTime);
      return nowMin >= s && nowMin < e;
    });
    markers.push({
      minutes: nowMin,
      timeLabel: formatHm(nowMin),
      caption: current?.label || (current?.number != null ? `Period ${current.number}` : 'Now'),
      kind: 'now',
    });
  }

  if (mid) {
    markers.push({
      minutes: toMinutes(mid.startTime),
      timeLabel: formatHm(toMinutes(mid.startTime)),
      caption: mid.label || 'Midday',
      kind: 'mid',
    });
  }

  markers.push({
    minutes: end,
    timeLabel: formatHm(end),
    caption: 'School ends',
    kind: 'end',
  });

  return { progress, markers, isWeekend };
}

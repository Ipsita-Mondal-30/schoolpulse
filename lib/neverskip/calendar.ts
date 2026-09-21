/**
 * NeverSkip Calendar API — observed 2026-09-21.
 * POST https://nskapi.neverskip.com/parentweb/lms/fetchcalenderapi
 * Browser body: {}
 * Envelope: { S, D: array | object, F }
 * For Class I-A parent session D was [] (no events). Sync still records a successful empty set.
 */

import { nsError, nsLog, nsWarn } from './log';
import { normalizeDate, normalizeTime } from './normalizers';
import type { NormalizedScheduleEvent } from './types';
import { NEVERSKIP_SOURCE } from './types';

export const CALENDAR_API_PATH = '/parentweb/lms/fetchcalenderapi';
export const CALENDAR_API_MATCH = '/parentweb/lms/fetchcalenderapi';
export const CALENDAR_PAGE = 'https://parent.neverskip.com/default/calendar';

export type NeverSkipCalendarResponse = {
  S?: boolean;
  D?: unknown;
  F?: string;
  M?: unknown;
};

export function isCalendarApiUrl(url: string): boolean {
  return url.includes(CALENDAR_API_MATCH);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Flatten calendar D into raw row objects (array or nested lists). */
export function extractCalendarRows(response: NeverSkipCalendarResponse | null | undefined): unknown[] {
  if (!response || typeof response !== 'object') return [];
  if (response.S === false) return [];
  const D = response.D;
  if (Array.isArray(D)) return D;
  if (!isObject(D)) return [];
  for (const key of ['item_list', 'list', 'events', 'data', 'rows', 'calendar', 'schedule']) {
    const v = D[key];
    if (Array.isArray(v)) return v;
  }
  // Some portals return date-keyed maps
  const values = Object.values(D);
  if (values.every((v) => Array.isArray(v))) {
    return values.flat();
  }
  if (values.length && values.every(isObject)) return values;
  return [];
}

export function isScheduleDocumentText(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(' ');
  return /timetable|time\s*table|class\s*schedule|period\s*grid|newsletter/i.test(blob);
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

export function normalizeCalendarEvent(raw: unknown, index: number): NormalizedScheduleEvent | null {
  if (!isObject(raw)) return null;
  const title =
    pickString(raw, ['title', 'event', 'event_title', 'name', 'subject_name', 'con_tit', 'label']) ||
    'Calendar event';
  const eventDate =
    normalizeDate(pickString(raw, ['event_date', 'date', 'sch_dt', 'cal_dt', 'day_date', 'dt']) || null) ||
    '';
  const startTime = normalizeTime(pickString(raw, ['start_time', 'start', 'sch_tm', 'from_tm', 'tm']) || null);
  const endTime = normalizeTime(pickString(raw, ['end_time', 'end', 'to_tm']) || null);
  const weekday = pickString(raw, ['weekday', 'day', 'day_name', 'dow']);
  const subjectName = pickString(raw, ['subject_name', 'subject', 'sub']) || null;
  const periodLabel = pickString(raw, ['period', 'period_label', 'slot', 'period_no']) || null;
  const classSection = pickString(raw, ['cls_sec', 'class_sec', 'section', 'class']) || null;
  const resourceUrl =
    pickString(raw, ['url', 'media_url', 'dwn_url', 'link', 'file_url']) || null;
  const description = pickString(raw, ['description', 'desc', 'details', 'content', 'full_desc']);

  const sourceId =
    pickString(raw, ['id', 'event_id', 'refid', 'cal_id', 'uid']) ||
    `cal:${eventDate || 'undated'}:${title}:${periodLabel || index}`;

  return {
    source: NEVERSKIP_SOURCE,
    sourceId,
    title,
    description,
    eventDate,
    startTime,
    endTime,
    weekday,
    subjectName,
    periodLabel,
    classSection,
    resourceUrl,
    metadataJson: JSON.stringify({
      keys: Object.keys(raw),
    }),
  };
}

export interface CalendarFetchResult {
  events: NormalizedScheduleEvent[];
  rawCount: number;
  incomplete: boolean;
  errors: string[];
  /** True when S:true and D parsed as array/object (including empty). */
  complete: boolean;
}

export function parseCalendarResponse(
  response: NeverSkipCalendarResponse | null | undefined,
): CalendarFetchResult {
  if (response == null) {
    nsError('CALENDAR SYNC = FAILED — empty response');
    return {
      events: [],
      rawCount: 0,
      incomplete: true,
      errors: ['CALENDAR SYNC = FAILED — empty response'],
      complete: false,
    };
  }
  if (response.S === false) {
    const msg = 'CALENDAR SYNC = AUTHENTICATION_REQUIRED — failure envelope';
    nsError(msg);
    return { events: [], rawCount: 0, incomplete: true, errors: [msg], complete: false };
  }

  const rows = extractCalendarRows(response);
  const events: NormalizedScheduleEvent[] = [];
  for (let i = 0; i < rows.length; i++) {
    const n = normalizeCalendarEvent(rows[i], i);
    if (n) events.push(n);
  }
  nsLog(`CALENDAR events raw=${rows.length} normalized=${events.length}`);
  if (rows.length > 0 && events.length < rows.length) {
    nsWarn(`Calendar normalize dropped ${rows.length - events.length} rows`);
  }
  return {
    events,
    rawCount: rows.length,
    incomplete: false,
    errors: [],
    complete: true,
  };
}

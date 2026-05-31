import monthsIndex from '@/data/months-index.json';

import may2026 from '@/data/may-2026.json';
import june2026 from '@/data/june-2026.json';

export interface ScheduleItem {
  time: string;
  subject: string;
  activity: string;
}

export interface WeekendRevisionContent {
  weekCovered: string;
  subjects: {
    [key: string]: string[]; // Dynamic subject names with their topics
  };
}

export interface AISuggestedRecap {
  todayMission: string;
  activities: {
    subject: string;
    action: string;
    question?: string;
    goal: string;
  }[];
  parentTip: string;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: string;
  isHoliday: boolean;
  holidayName?: string;
  isWeekendRevision?: boolean;
  weekendRevisionContent?: WeekendRevisionContent;
  schedule: ScheduleItem[];
  aiSuggestedRecap?: AISuggestedRecap;
}

export interface WeekData {
  weekStart: string;
  weekEnd: string;
  dictationWords: string[];
  dictationSentences?: string[];
  days: DaySchedule[];
}

export interface Rhyme {
  title: string;
  content: string;
}

export interface ImportantDate {
  date: string;
  event: string;
  type: 'holiday' | 'event' | 'activity';
  description: string;
}

export interface MonthData {
  month: string;
  year: number;
  class: string;
  school: string;
  weeks: WeekData[];
  newsletterPending?: boolean;
  newsletterPendingMessage?: string;
  rhymes?: Rhyme[];
  shloka?: {
    sanskrit: string;
    transliteration: string;
    meaning: string;
  };
  story?: {
    title: string;
    content?: string;
    moral: string;
    image?: string;
  };
  importantDates?: ImportantDate[];
}

export interface MonthInfo {
  id: string;
  month: string;
  year: number;
  file: string;
}

export interface Announcement {
  id: number;
  message: string;
  title?: string;
  priority?: number;
  category?: string;
  type: 'info' | 'warning' | 'holiday' | 'important' | 'urgent' | 'notice' | 'event' | 'homework';
  link?: string;
  linkText?: string;
  createdAt: string;
  expiresAt: string;
  status?: string;
}

// Map of month IDs to their data
const monthDataMap: Record<string, MonthData> = {
  'may-2026': may2026 as MonthData,
  'june-2026': june2026 as MonthData,
};

export function getAvailableMonths(): MonthInfo[] {
  return monthsIndex.months;
}

export function findMonthForDate(date: string): string | null {
  const months = getAvailableMonths();
  for (const month of months) {
    const data = monthDataMap[month.id];
    if (data) {
      for (const week of data.weeks) {
        if (week.days.some((d) => d.date === date)) {
          return month.id;
        }
      }
    }
  }
  return null;
}

// Helper to get local YYYY-MM-DD string
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthId(): string {
  // Try to find the month that contains today's date
  const today = toLocalDateString(new Date());
  const monthForToday = findMonthForDate(today);

  // If today's date is found in any month data, use that month
  if (monthForToday) {
    return monthForToday;
  }

  // Otherwise, fall back to the configured current month
  return monthsIndex.currentMonth;
}

export function getMonthData(monthId?: string): MonthData {
  const id = monthId || getCurrentMonthId();
  return monthDataMap[id] || monthDataMap[getCurrentMonthId()];
}


export function getDaySchedule(date: string, monthId?: string): DaySchedule | null {
  const data = getMonthData(monthId);
  for (const week of data.weeks) {
    const day = week.days.find((d) => d.date === date);
    if (day) return day;
  }
  return null;
}

export function getWeekForDate(date: string, monthId?: string): WeekData | null {
  const data = getMonthData(monthId);
  const targetDate = new Date(date);

  for (const week of data.weeks) {
    const weekStart = new Date(week.weekStart);
    const weekEnd = new Date(week.weekEnd);
    if (targetDate >= weekStart && targetDate <= weekEnd) {
      return week;
    }
  }
  return null;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function getToday(): string {
  return toLocalDateString(new Date());
}

export function getAllDates(monthId?: string): string[] {
  const data = getMonthData(monthId);
  const dates: string[] = [];
  for (const week of data.weeks) {
    for (const day of week.days) {
      dates.push(day.date);
    }
  }
  return dates.sort();
}

export function getImportantDates(monthId?: string): ImportantDate[] {
  const data = getMonthData(monthId);
  return data.importantDates || [];
}

export function getUpcomingEvents(daysAhead: number = 7): ImportantDate[] {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  const todayStr = toLocalDateString(today);
  const futureStr = toLocalDateString(futureDate);

  // Gather from all months
  const months = getAvailableMonths();
  const allEventsMap = new Map<string, ImportantDate>();

  for (const month of months) {
    const data = monthDataMap[month.id];
    if (data?.importantDates) {
      data.importantDates.forEach((e) => {
        const key = `${e.date}-${e.event}`;
        if (!allEventsMap.has(key)) {
          allEventsMap.set(key, e);
        }
      });
    }
  }

  const allEvents = Array.from(allEventsMap.values());

  return allEvents
    .filter((e) => e.date >= todayStr && e.date <= futureStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTodayEvent(): ImportantDate | null {
  const today = getToday();
  const months = getAvailableMonths();

  for (const month of months) {
    const data = monthDataMap[month.id];
    if (data?.importantDates) {
      const event = data.importantDates.find((e) => e.date === today);
      if (event) return event;
    }
  }
  return null;
}

export function getSubjectColor(subject: string): string {
  const colors: Record<string, string> = {
    'LITERACY': 'bg-blue-100 text-blue-800 border-blue-200',
    'NUMERACY': 'bg-green-100 text-green-800 border-green-200',
    'KANNADA': 'bg-purple-100 text-purple-800 border-purple-200',
    'HINDI': 'bg-pink-100 text-pink-800 border-pink-200',
    'GENERAL AWARENESS': 'bg-amber-100 text-amber-800 border-amber-200',
    'STORY': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'ART': 'bg-rose-100 text-rose-800 border-rose-200',
    'Snack Break': 'bg-orange-50 text-orange-600 border-orange-200',
    'Prayer/Rhymes & Circle Time': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'General Assembly': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Meditation': 'bg-teal-50 text-teal-700 border-teal-200',
    'MAKAR SANKRANTI ACTIVITY': 'bg-orange-100 text-orange-800 border-orange-200',
    'SOCIO EMOTIONAL SKILLS': 'bg-violet-100 text-violet-800 border-violet-200',
  };

  // Check for partial matches
  for (const [key, value] of Object.entries(colors)) {
    if (subject.toUpperCase().includes(key.toUpperCase())) {
      return value;
    }
  }

  return 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getSchoolContactInfo() {
  return {
    coordinatorEmail: 'bgsnpscoordinatorI@gmail.com',
    principalName: 'Dr. Malini Dutta',
    principalEmail: 'principal@bgsnps.edu.in',
    schoolEmail: 'bgsnps@yahoo.com',
    website: 'www.bgsnps.edu.in',
    phone: '7676242907, 9483338135, 080-26421581, 080-26421582'
  };
}

export async function getExternalUpdates(): Promise<Announcement[]> {
  const SHEET_URL = process.env.NEXT_PUBLIC_UPDATES_SHEET_URL;
  if (!SHEET_URL) {
    console.error('DEBUG: NEXT_PUBLIC_UPDATES_SHEET_URL is missing or empty');
    return [];
  }

  console.log('DEBUG: Fetching from URL:', SHEET_URL);

  try {
    const response = await fetch(SHEET_URL, {
      next: { revalidate: 0 },
    });

    console.log('DEBUG: Response Status:', response.status);

    if (!response.ok) {
      console.error('DEBUG: Fetch failed with status:', response.status);
      return [];
    }

    const csvData = await response.text();
    console.log('DEBUG: CSV Data Length:', csvData.length);
    console.log('DEBUG: First 100 chars:', csvData.substring(0, 100));

    // Robust CSV parser to handle commas inside quotes
    const parseCSV = (text: string) => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n' && !inQuotes) {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
      }
      return rows;
    };

    const rows = parseCSV(csvData);
    if (rows.length < 2) return [];

    // Find the header row (it might not be the first row due to empty lines)
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(c => c.toLowerCase().trim());
      if (row.includes('category') && row.includes('title')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.warn('Could not find header row in CSV');
      return [];
    }

    // Map the new human-friendly headers
    const row0 = rows[headerRowIndex].map(h => h.toLowerCase().trim());
    const headerMap = {
      status: row0.indexOf('status'),
      category: row0.indexOf('category'),
      title: row0.indexOf('title'),
      message: row0.indexOf('notification message'),
      action: row0.indexOf('action'),
      link: row0.indexOf('link to action'),
      date: row0.indexOf('date'),
      expires: row0.indexOf('expires')
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseSheetDate = (dateStr: string) => {
      if (!dateStr || dateStr === '-') return null;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    };

    const updates = rows.slice(headerRowIndex + 1).map((row, idx) => {
      try {
        const status = row[headerMap.status] || '';
        const category = row[headerMap.category] || '';
        const title = row[headerMap.title] || '';
        const message = row[headerMap.message] || '';
        const actionText = row[headerMap.action] === '-' ? '' : row[headerMap.action];
        const link = row[headerMap.link] === '-' ? '' : row[headerMap.link];
        const date = row[headerMap.date] || '';
        const expires = row[headerMap.expires] || '';

        // Infer priority and type from Category
        let priority = 3;
        let type: any = 'info';

        if (category.toLowerCase().includes('urgent')) {
          priority = 1;
          type = 'urgent';
        } else if (category.toLowerCase().includes('holiday')) {
          priority = 2;
          type = 'holiday';
        } else if (category.toLowerCase().includes('school')) {
          priority = 2;
          type = 'notice';
        } else if (category.toLowerCase().includes('home')) {
          priority = 2;
          type = 'info';
        }

        return {
          id: idx + 1,
          status, // Store status
          priority,
          category,
          title,
          message,
          type,
          link,
          linkText: actionText,
          createdAt: date,
          expiresAt: expires
        };
      } catch (e) {
        console.warn('Error parsing update row:', e);
        return null;
      }
    }).filter((u): u is NonNullable<typeof u> => u !== null).filter(u => {
      // 1. If Status is 'inactive', hide it.
      if (u.status && u.status.toLowerCase().trim() === 'inactive') return false;

      // 2. If Status is empty, show it (irrespective of expiry).
      if (!u.status || u.status.trim() === '') return true;

      // 3. Otherwise (e.g. Status is 'Active'), check expiry.
      const expiry = parseSheetDate(u.expiresAt);
      if (!expiry) return true;
      expiry.setHours(23, 59, 59, 999);
      return expiry >= today;
    });

    return updates.sort((a, b) => a.priority - b.priority);
  } catch (error) {
    console.error('Error fetching external updates:', error);
    return [];
  }
}

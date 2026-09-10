'use server';

import { Announcement } from '@/lib/data';

// Define Homework Interface locally or import if available
export interface Homework {
    id: string;
    status: string;
    subject: string;
    content: string;
    submissionDate: string;
    notes?: string;
    createdAt?: string;
}

const UPDATES_REVALIDATE_SECONDS = 60;

export async function fetchExternalUpdates(): Promise<Announcement[]> {
    const SHEET_URL = process.env.NEXT_PUBLIC_UPDATES_SHEET_URL;

    if (!SHEET_URL) {
        console.error('SERVER ACTION ERROR: NEXT_PUBLIC_UPDATES_SHEET_URL is missing');
        return [];
    }

    try {
        const response = await fetch(SHEET_URL, {
            next: { revalidate: 900 }, // Cache for 15 minutes to prevent frequent reloading
        });

        console.log('SERVER ACTION: Response status:', response.status);

        if (!response.ok) {
            console.error('SERVER ACTION ERROR: Failed to fetch CSV', response.status, response.statusText);
            return [];
        }

        const csvData = await response.text();
        console.log('SERVER ACTION: CSV Data received, length:', csvData.length);
        console.log('SERVER ACTION: Start of CSV:', csvData.substring(0, 100));

        // Simple CSV Parser
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
        if (rows.length < 2) {
            console.warn('SERVER ACTION: CSV has fewer than 2 rows (no data?)');
            return [];
        }

        // Find header
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i].map(c => c.toLowerCase().trim());
            if (row.includes('category') && row.includes('title')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            console.warn('SERVER ACTION: Could not find header row');
            return [];
        }

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

                if (!category && !title) return null;

                const message = row[headerMap.message] || '';
                const actionText = row[headerMap.action] === '-' ? '' : row[headerMap.action];
                const link = row[headerMap.link] === '-' ? '' : row[headerMap.link];
                const date = row[headerMap.date] || '';
                const expires = row[headerMap.expires] || '';

                let priority = 3;
                let type: any = 'info';

                if (category.toLowerCase().includes('urgent')) {
                    priority = 1;
                    type = 'urgent';
                } else if (category.toLowerCase().includes('holiday')) {
                    priority = 2;
                    type = 'holiday';
                } else if (category.toLowerCase().includes('homework')) {
                    priority = 2;
                    type = 'homework';
                } else if (category.toLowerCase().includes('school')) {
                    priority = 2;
                    type = 'notice';
                } else if (category.toLowerCase().includes('home')) {
                    priority = 2;
                    type = 'info';
                }

                return {
                    id: idx + 1,
                    status,
                    priority,
                    category,
                    title,
                    message,
                    type,
                    link,
                    linkText: actionText,
                    createdAt: date,
                    expiresAt: expires
                } as Announcement;
            } catch (err) {
                return null;
            }
        }).filter((u): u is Announcement => u !== null).filter(u => {
            // 1. Inactive -> Hide
            if (u.status && u.status.toLowerCase().trim() === 'inactive') return false;
            // 2. Empty -> Show Always
            if (!u.status || u.status.trim() === '') return true;
            // 3. Active -> Check Date
            const expiry = parseSheetDate(u.expiresAt);
            if (!expiry) return true;
            expiry.setHours(23, 59, 59, 999);
            return expiry >= today;
        });

        console.log('SERVER ACTION: Processed updates count:', updates.length);
        return updates.sort((a, b) => (a.priority || 3) - (b.priority || 3));

    } catch (error) {
        console.error('SERVER ACTION ERROR: Exception during fetch/parse', error);
        return [];
    }
}

export async function fetchHomework(): Promise<Homework[]> {
    try {
        // Fetch local homework records
        let localHw: Homework[] = [];
        try {
            const fs = require('fs');
            const path = require('path');
            const dataPath = path.join(process.cwd(), 'data', 'homework.json');
            if (fs.existsSync(dataPath)) {
                const fileContent = fs.readFileSync(dataPath, 'utf8');
                const rawLocal = JSON.parse(fileContent);
                localHw = rawLocal.map((item: any) => ({
                    id: item.id,
                    status: 'Active',
                    subject: item.subject,
                    content: item.content,
                    submissionDate: item.submissionDate,
                    notes: JSON.stringify({ assigned: item.homeworkDate, chapter: item.chapter || '' }),
                    createdAt: item.homeworkDate
                }));
            }
        } catch (e) {
            console.error('Failed to load local homework.json data', e);
        }

        // Reuse the main updates fetcher
        const allUpdates = await fetchExternalUpdates();

        // Filter only homework items
        const homeworkUpdates = allUpdates.filter(u => {
            const isHw = u.category?.toLowerCase().includes('homework') || u.type === 'homework';
            return isHw;
        });

        const sheetHw = homeworkUpdates.map((u) => {
            return {
                id: `hw-${u.id}`,
                status: 'Active',
                subject: u.title || 'General',
                content: u.message,
                submissionDate: u.expiresAt,
                notes: u.link ? `Link: ${u.link}` : '',
                createdAt: u.createdAt
            } as Homework;
        });

        return [...localHw, ...sheetHw];
    } catch (error) {
        console.error('Failed to fetch homework from updates', error);
        return [];
    }
}

// ----- Events (from separate sheet tab) -----

export interface SchoolEvent {
    id: string;
    topic: string;
    toDo: string;
    registrationDeadline: string;
    competitionDate: string;
    registrationMode: string;
    fees: string;
}

export async function fetchEvents(): Promise<SchoolEvent[]> {
    const BASE_URL = process.env.NEXT_PUBLIC_UPDATES_SHEET_URL;

    if (!BASE_URL) {
        console.error('SERVER ACTION ERROR: NEXT_PUBLIC_UPDATES_SHEET_URL is missing');
        return [];
    }

    // Extract the spreadsheet ID from the base URL and build a clean events sheet URL
    // This works regardless of whether the base URL has a gid param or not
    const sheetIdMatch = BASE_URL.match(/\/spreadsheets\/d\/([^/]+)\//);
    if (!sheetIdMatch) {
        console.error('EVENTS: Could not extract spreadsheet ID from', BASE_URL);
        return [];
    }
    const SHEET_URL = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv&gid=1056366110`;

    try {
        console.log('EVENTS: Fetching from', SHEET_URL);
        const response = await fetch(SHEET_URL, {
            next: { revalidate: 60 } // Cache for 1 minute to prevent slow page load transitions
        });
        console.log('EVENTS: Response status', response.status);

        if (!response.ok) return [];

        const csvData = await response.text();
        console.log('EVENTS: CSV length', csvData.length, '| Start:', csvData.substring(0, 80));

        const parseCSV = (text: string) => {
            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentCell = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; }
                else if (char === '\n' && !inQuotes) { currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = ''; }
                else { currentCell += char; }
            }
            if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
            return rows;
        };

        const rows = parseCSV(csvData);
        console.log('EVENTS: Total rows parsed', rows.length);
        if (rows.length < 2) return [];

        // Find header row (contains 'topic')
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].some(c => c.toLowerCase().includes('topic'))) { headerIdx = i; break; }
        }
        console.log('EVENTS: Header row index', headerIdx);
        if (headerIdx === -1) return [];

        const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
        console.log('EVENTS: Headers', headers);
        const col = (name: string) => headers.findIndex(h => h.includes(name));

        const idxTopic = col('topic');
        const idxToDo = col('to do');
        const idxRegDate = col('last date');
        const idxCompDate = col('date of');
        const idxMode = col('mode');
        const idxFees = col('fees');

        const result = rows.slice(headerIdx + 1)
            .filter(row => row[idxTopic] && row[idxTopic].trim() !== '')
            .map((row, i) => ({
                id: `evt-${i + 1}`,
                topic: row[idxTopic] || '',
                toDo: row[idxToDo] || '',
                registrationDeadline: row[idxRegDate] || '-',
                competitionDate: row[idxCompDate] || '-',
                registrationMode: row[idxMode] || '-',
                fees: row[idxFees] || '-',
            }));

        console.log('EVENTS: Parsed event count', result.length);
        return result;

    } catch (error) {
        console.error('Failed to fetch events', error);
        return [];
    }
}

// ----- Section-wise Homework (from Google Sheet) -----

export interface SheetHomework {
    id: string;
    sentDate: string;
    section: string;
    subject: string;
    title: string;
    description: string;
    submissionDate: string;
}

export async function fetchSheetHomework(): Promise<SheetHomework[]> {
    const BASE_URL = process.env.NEXT_PUBLIC_UPDATES_SHEET_URL;

    if (!BASE_URL) {
        return [];
    }

    const sheetIdMatch = BASE_URL.match(/\/spreadsheets\/d\/([^/]+)\//);
    if (!sheetIdMatch) return [];

    const gid = process.env.NEXT_PUBLIC_HOMEWORK_SHEET_GID;
    if (!gid) {
        console.error('HOMEWORK_SHEET: NEXT_PUBLIC_HOMEWORK_SHEET_GID not set');
        return [];
    }

    const SHEET_URL = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv&gid=${gid}`;

    try {
        const response = await fetch(SHEET_URL, {
            next: { revalidate: 60 }
        });

        if (!response.ok) return [];

        const csvData = await response.text();

        const parseCSV = (text: string) => {
            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentCell = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; }
                else if (char === '\n' && !inQuotes) { currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = ''; }
                else { currentCell += char; }
            }
            if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
            return rows;
        };

        const rows = parseCSV(csvData);
        if (rows.length < 2) return [];

        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            const lower = rows[i].map(c => c.toLowerCase().trim());
            if (lower.includes('section') && lower.includes('subject')) {
                headerIdx = i;
                break;
            }
        }
        if (headerIdx === -1) return [];

        const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
        const col = (name: string) => headers.findIndex(h => h.includes(name));

        const idxDate = col('sent date');
        const idxSection = col('section');
        const idxSubject = col('subject');
        const idxTitle = col('title');
        const idxDesc = col('description');
        const idxSubmit = col('submission date');

        return rows.slice(headerIdx + 1)
            .filter(row => row[idxSection] && row[idxSection].trim() !== '')
            .map((row, i) => ({
                id: `sheet-hw-${i + 1}`,
                sentDate: row[idxDate] || '',
                section: row[idxSection] || '',
                subject: row[idxSubject] || '',
                title: row[idxTitle] || '',
                description: row[idxDesc] || '',
                submissionDate: row[idxSubmit] || '',
            }));

    } catch (error) {
        console.error('HOMEWORK_SHEET: Failed to fetch', error);
        return [];
    }
}

// ----- Imported NeverSkip data (Prisma) → UI -----

export interface ImportedHomeworkItem {
    id: string;
    title: string;
    subject: string;
    sections: string[];
    description: string;
    submissionDate?: string;
    sentDate: string;
    attachmentImage?: string;
}

export interface ImportedNoticeItem {
    id: string;
    date: string;
    time: string;
    classes: string[];
    summary: string;
    message: string;
}

function sheetRowsToHomeworkItems(rows: SheetHomework[]): ImportedHomeworkItem[] {
    const grouped: Record<string, ImportedHomeworkItem> = {};

    for (const row of rows) {
        const key = `${row.sentDate}|${row.subject}|${row.title}`;
        if (grouped[key]) {
            if (!grouped[key].sections.includes(row.section)) {
                grouped[key].sections.push(row.section);
            }
        } else {
            grouped[key] = {
                id: row.id,
                title: row.title,
                subject: row.subject,
                sections: [row.section],
                description: row.description,
                submissionDate: row.submissionDate || undefined,
                sentDate: row.sentDate,
            };
        }
    }

    return Object.values(grouped);
}

export async function fetchImportedHomework(): Promise<ImportedHomeworkItem[]> {
    try {
        if (!process.env.DATABASE_URL) {
            console.log('[SchoolPulse] UI DB homework count: 0 (DATABASE_URL missing)');
            return [];
        }
        const { PrismaNeverSkipStore } = await import('@/lib/neverskip/prisma-store');
        const { uiHomeworkId } = await import('@/lib/neverskip/ids');
        const { toSortableDate } = await import('@/lib/ui-merge');
        const store = new PrismaNeverSkipStore();
        const rows = await store.listHomework();
        return rows.map((h) => ({
            id: uiHomeworkId(h.sourceId, h.source),
            title: h.title,
            subject: h.subjectName,
            // Ensure section filter always has at least Class 1 default when API omitted targeting
            sections: h.sections.length > 0 ? h.sections : ['I-A'],
            description: h.description,
            submissionDate: h.dueDate || undefined,
            sentDate: toSortableDate(h.homeworkDate) || h.homeworkDate,
            attachmentImage: h.attachmentUrl || undefined,
        }));
    } catch (error) {
        console.error('Failed to fetch imported homework', error);
        console.log('[SchoolPulse] UI DB homework count: 0 (error)');
        return [];
    }
}

export async function fetchImportedNotices(): Promise<ImportedNoticeItem[]> {
    try {
        if (!process.env.DATABASE_URL) {
            console.log('[SchoolPulse] UI DB notice count: 0 (DATABASE_URL missing)');
            return [];
        }
        const { getPrisma } = await import('@/lib/prisma');
        const { uiNoticeId } = await import('@/lib/neverskip/ids');
        const {
            noticeSummaryForUi,
            resolveNoticeClassesForUi,
            resolveNoticeDateForUi,
        } = await import('@/lib/ui-merge');

        // Query Prisma directly so UI can use createdAt when publishedDate is blank.
        // Does not change NeverSkip normalization / ingestion.
        const rows = await getPrisma().importedNotice.findMany({
            orderBy: [{ createdAt: 'desc' }],
        });

        return rows.map((n) => {
            let classes: string[] = [];
            try {
                const parsed = JSON.parse(n.classesJson);
                classes = Array.isArray(parsed) ? parsed.map(String) : [];
            } catch {
                classes = [];
            }

            return {
                id: uiNoticeId(n.sourceId, n.source),
                date: resolveNoticeDateForUi({
                    publishedDate: n.publishedDate,
                    title: n.title,
                    summary: n.summary,
                    content: n.content,
                    createdAt: n.createdAt,
                }),
                time: n.publishedTime || '00:00',
                classes: resolveNoticeClassesForUi(classes, n.title, n.summary, n.content),
                summary: noticeSummaryForUi(n.title, n.summary, n.content),
                message: n.content,
            };
        });
    } catch (error) {
        console.error('Failed to fetch imported notices', error);
        console.log('[SchoolPulse] UI DB notice count: 0 (error)');
        return [];
    }
}

/** Server-side merge for Homework UI: Prisma ∪ sheet ∪ JSON. */
export async function loadHomeworkForUi(): Promise<{
    items: ImportedHomeworkItem[];
    fromSheet: boolean;
}> {
    const { mergeHomeworkItems } = await import('@/lib/ui-merge');
    const localMod = await import('@/data/school-homework.json');
    const local = localMod.default as ImportedHomeworkItem[];

    const [imported, sheetRows] = await Promise.all([
        fetchImportedHomework(),
        fetchSheetHomework(),
    ]);
    const sheet = sheetRowsToHomeworkItems(sheetRows);
    const merged = mergeHomeworkItems(imported, sheet, local);

    console.log(`[SchoolPulse] UI DB homework count: ${imported.length}`);
    console.log(`[SchoolPulse] UI JSON/sheet homework count: ${local.length + sheet.length}`);
    console.log(`[SchoolPulse] UI merged homework count: ${merged.length}`);

    return { items: merged, fromSheet: sheet.length > 0 };
}

/** Server-side merge for Notices UI: Prisma ∪ JSON. */
export async function loadNoticesForUi(): Promise<ImportedNoticeItem[]> {
    const { mergeNoticeItems, sortNoticesNewestFirst } = await import('@/lib/ui-merge');
    const localMod = await import('@/data/notices.json');
    const local = (localMod.default as { notices: ImportedNoticeItem[] }).notices;

    const imported = await fetchImportedNotices();
    const merged = sortNoticesNewestFirst(mergeNoticeItems(imported, local));

    console.log(`[SchoolPulse] UI DB notice count: ${imported.length}`);
    console.log(`[SchoolPulse] UI JSON/sheet notice count: ${local.length}`);
    console.log(`[SchoolPulse] UI merged notice count: ${merged.length}`);

    return merged;
}

/** Tonight Daily Brief: reuses homework/notices loaders; does not invent due dates. */
export async function loadDailyBriefForUi(options?: {
    today?: string;
    section?: string;
}): Promise<import('@/lib/daily-brief').DailyBrief> {
    const { buildDailyBrief, getIndiaToday, addDaysYmd } = await import('@/lib/daily-brief');
    const { getAllImportantDates } = await import('@/lib/data');

    const today = options?.today || getIndiaToday();
    const section = options?.section || 'I-A';
    const tomorrow = addDaysYmd(today, 1);

    const [homeworkResult, notices] = await Promise.all([
        loadHomeworkForUi(),
        loadNoticesForUi(),
    ]);

    const calendarItems = getAllImportantDates()
        .filter((e) => e.date === today || e.date === tomorrow)
        .map((e) => ({
            date: e.date,
            event: e.event,
            description: e.description,
        }));

    return buildDailyBrief({
        homework: homeworkResult.items,
        notices,
        today,
        section,
        calendarItems,
    });
}

export interface UiChangeField {
    field: string;
    label: string;
    previous: string | null;
    current: string | null;
    reliable: boolean;
}

export interface UiChangeItem {
    id: string;
    type: 'homework' | 'notice';
    sourceId: string;
    subject?: string;
    title: string;
    detectedAt: string; // ISO
    changedFields: UiChangeField[];
    hasReliablePreviousValue: boolean;
}

/** Recent NeverSkip content change events (last N days). Newest first. */
export async function loadRecentChanges(options?: {
    days?: number;
}): Promise<UiChangeItem[]> {
    try {
        if (!process.env.DATABASE_URL) return [];

        const { getPrisma } = await import('@/lib/prisma');
        const {
            parseFieldChanges,
            hasReliablePreviousForType,
            userVisibleChanges,
        } = await import('@/lib/neverskip/changes');

        const days = options?.days ?? 30;
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - days);

        const rows = await getPrisma().contentChangeEvent.findMany({
            where: { detectedAt: { gte: since } },
            orderBy: { detectedAt: 'desc' },
            take: 200,
        });

        return rows.map((row) => {
            const type = row.entityType === 'notice' ? 'notice' : 'homework';
            const allFields = parseFieldChanges(row.changedFieldsJson);
            const changedFields = userVisibleChanges(type, allFields).map((c) => ({
                field: c.field,
                label: c.label,
                previous: c.previous,
                current: c.current,
                reliable: c.reliable,
            }));

            let subject: string | undefined;
            let title = type === 'notice' ? 'School notice' : 'Homework';
            try {
                const snap = JSON.parse(row.currentSnapshotJson) as Record<string, unknown>;
                if (type === 'homework') {
                    subject = typeof snap.subjectName === 'string' ? snap.subjectName : undefined;
                    title = typeof snap.title === 'string' && snap.title.trim() ? snap.title : title;
                } else {
                    title =
                        (typeof snap.title === 'string' && snap.title.trim()
                            ? snap.title
                            : typeof snap.summary === 'string' && snap.summary.trim()
                              ? snap.summary
                              : title) as string;
                }
            } catch {
                /* keep defaults */
            }

            return {
                id: row.id,
                type,
                sourceId: row.sourceId,
                subject,
                title,
                detectedAt: row.detectedAt.toISOString(),
                changedFields,
                hasReliablePreviousValue: hasReliablePreviousForType(type, allFields),
            };
        });
    } catch (error) {
        console.error('Failed to load recent changes', error);
        return [];
    }
}




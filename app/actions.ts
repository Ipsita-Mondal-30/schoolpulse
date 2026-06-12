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


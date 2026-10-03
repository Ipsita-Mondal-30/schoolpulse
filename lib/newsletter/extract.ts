/**
 * Gemini vision extraction of the monthly school newsletter PDF (pages are images).
 * Server/worker only. Output must pass validateNewsletterExtraction before use.
 */

import { createPartFromUri, GoogleGenAI } from '@google/genai';
import { getGeminiModelId } from '@/lib/recap/ai';
import type { NewsletterExtraction } from './validate';

const PROMPT = `You are reading a primary-school monthly newsletter PDF (Class I). Pages are scanned images.
Extract ONLY what is printed. Do not invent anything.
- month / year: the month the newsletter is FOR (e.g. "October", 2026).
- title: the newsletter title line if present.
- monthlyPlanner: one entry per subject in the monthly planner / syllabus table:
  subject name, portions (chapters/topics, one per item), activities (one per item).
- importantDates: dated events/holidays/activities listed for the month.
  date as YYYY-MM-DD; type one of holiday | event | activity | important.
- jolTimetable: ONLY if the newsletter has a "Joy of Learning ... Worksheet ... Timetable" table.
  days: one row per date with date (YYYY-MM-DD), weekday (full English name), classI subject, classII subject.
  If both classes share a cell (e.g. "Study Holiday"), repeat it for both. Otherwise null.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    month: { type: 'string' },
    year: { type: 'integer' },
    title: { type: 'string' },
    monthlyPlanner: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          portions: { type: 'array', items: { type: 'string' } },
          activities: { type: 'array', items: { type: 'string' } },
        },
        required: ['subject', 'portions', 'activities'],
      },
    },
    importantDates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          event: { type: 'string' },
          type: { type: 'string', enum: ['holiday', 'event', 'activity', 'important'] },
          description: { type: 'string' },
        },
        required: ['date', 'event', 'type', 'description'],
      },
    },
    jolTimetable: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        academicYear: { type: 'string' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              weekday: { type: 'string' },
              classI: { type: 'string' },
              classII: { type: 'string' },
            },
            required: ['date', 'weekday', 'classI', 'classII'],
          },
        },
      },
      required: ['days'],
    },
  },
  required: ['month', 'year', 'monthlyPlanner', 'importantDates'],
};

export function newsletterModelId(): string {
  return process.env.NEWSLETTER_GEMINI_MODEL?.trim() || getGeminiModelId();
}

export async function extractNewsletterWithGemini(pdf: Buffer): Promise<NewsletterExtraction> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  const ai = new GoogleGenAI({ apiKey });

  let file = await ai.files.upload({
    file: new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
    config: { mimeType: 'application/pdf', displayName: 'schoolpulse-newsletter.pdf' },
  });
  for (let i = 0; i < 30 && file.state === 'PROCESSING' && file.name; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state === 'FAILED' || !file.uri) throw new Error(`Gemini file processing failed (${file.state})`);

  try {
    const res = await ai.models.generateContent({
      model: newsletterModelId(),
      contents: [
        {
          role: 'user',
          parts: [createPartFromUri(file.uri, file.mimeType || 'application/pdf'), { text: PROMPT }],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });
    const text = res.text?.trim();
    if (!text) throw new Error('Gemini returned empty response');
    return JSON.parse(text) as NewsletterExtraction;
  } finally {
    if (file.name) await ai.files.delete({ name: file.name }).catch(() => undefined);
  }
}

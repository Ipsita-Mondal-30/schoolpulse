/**
 * Server-only Veo video generation via the official Google GenAI SDK.
 * Uses GOOGLE_GENERATIVE_AI_API_KEY (same key as Today's Recap / @ai-sdk/google).
 * Never import from client components. Never log the API key.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GoogleGenAI } from '@google/genai';

/** Official Gemini API Veo model (ai.google.dev/gemini-api/docs/video). */
export const DEFAULT_VEO_MODEL = 'veo-3.1-generate-preview';

export const VEO_SMOKE_PROMPT =
  'Friendly colorful 3D educational animation for a Class 1 child. A red ball, blue cube and yellow triangle appear one by one in a bright classroom. Gentle playful movement, simple clean background, no written text, child-friendly educational style.';

const POLL_MS = 10_000;
const MAX_WAIT_MS = 12 * 60_000;

export function getVeoModelId(): string {
  return process.env.VEO_MODEL?.trim() || DEFAULT_VEO_MODEL;
}

export function assertGeminiApiKeyForVeo(): string {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  }
  return key;
}

export function createGenAIClient(apiKey?: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey: apiKey ?? assertGeminiApiKeyForVeo() });
}

export type VeoGenerateResult = {
  model: string;
  operationName: string | undefined;
  downloadPath: string;
  fileBytes: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip anything that looks like an API key fragment.
  return raw
    .replace(/key[=:]\s*["']?[A-Za-z0-9_\-]{8,}["']?/gi, 'key=***')
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, 'AIza***')
    .slice(0, 800);
}

export function formatVeoError(err: unknown): string {
  return sanitizeProviderError(err);
}

/**
 * Submit a text→video job, poll until done/failed, download MP4 to disk.
 */
export async function generateAndDownloadVeoVideo(options: {
  prompt: string;
  downloadPath: string;
  model?: string;
  numberOfVideos?: number;
  aspectRatio?: '16:9' | '9:16';
  onPoll?: (info: { elapsedMs: number; done: boolean }) => void;
}): Promise<VeoGenerateResult> {
  const apiKey = assertGeminiApiKeyForVeo();
  const model = options.model || getVeoModelId();
  const ai = createGenAIClient(apiKey);

  mkdirSync(dirname(options.downloadPath), { recursive: true });

  let operation = await ai.models.generateVideos({
    model,
    source: {
      prompt: options.prompt,
    },
    config: {
      numberOfVideos: options.numberOfVideos ?? 1,
      aspectRatio: options.aspectRatio ?? '16:9',
    },
  });

  const started = Date.now();
  while (!operation.done) {
    const elapsedMs = Date.now() - started;
    if (elapsedMs > MAX_WAIT_MS) {
      throw new Error(`Veo operation timed out after ${Math.round(MAX_WAIT_MS / 1000)}s`);
    }
    options.onPoll?.({ elapsedMs, done: false });
    await sleep(POLL_MS);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  options.onPoll?.({ elapsedMs: Date.now() - started, done: true });

  if (operation.error) {
    const msg =
      typeof operation.error === 'object' && operation.error && 'message' in operation.error
        ? String((operation.error as { message?: unknown }).message || JSON.stringify(operation.error))
        : JSON.stringify(operation.error);
    throw new Error(`Veo operation failed: ${sanitizeProviderError(msg)}`);
  }

  const generated = operation.response?.generatedVideos?.[0];
  const video = generated?.video;
  if (!video) {
    const filtered = operation.response?.raiMediaFilteredCount;
    throw new Error(
      filtered
        ? `Veo returned no video (RAI filtered count=${filtered})`
        : 'Veo returned no generated video',
    );
  }

  await ai.files.download({
    file: video,
    downloadPath: options.downloadPath,
  });

  const { statSync } = await import('node:fs');
  const st = statSync(options.downloadPath);
  if (!st.isFile() || st.size < 1000) {
    throw new Error(`Downloaded video missing or too small (${st.size} bytes)`);
  }

  return {
    model,
    operationName: operation.name,
    downloadPath: options.downloadPath,
    fileBytes: st.size,
  };
}

/** Default local path for smoke-test output (gitignored). */
export function defaultSmokeVideoPath(cwd = process.cwd()): string {
  return join(cwd, 'data', 'generated-videos', `veo-smoke-${Date.now()}.mp4`);
}

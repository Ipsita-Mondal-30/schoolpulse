/**
 * Server-side Veo smoke test (Gemini API).
 * Run: npm run test:veo
 *
 * Never logs GOOGLE_GENERATIVE_AI_API_KEY or other secrets.
 * Stops with a clear provider error if the key cannot use Veo.
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Prefer local Next-style env files without committing secrets.
for (const name of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

import {
  DEFAULT_VEO_MODEL,
  VEO_SMOKE_PROMPT,
  defaultSmokeVideoPath,
  formatVeoError,
  generateAndDownloadVeoVideo,
  getVeoModelId,
} from '../lib/ai/veo';

async function main() {
  const hasKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  const model = getVeoModelId();
  const outPath = defaultSmokeVideoPath();

  console.log('--- SchoolPulse Veo smoke test ---');
  console.log('SDK: @google/genai (models.generateVideos)');
  console.log('Model:', model, model === DEFAULT_VEO_MODEL ? '(default)' : '(VEO_MODEL override)');
  console.log('GOOGLE_GENERATIVE_AI_API_KEY configured:', hasKey ? 'yes' : 'no');
  console.log('Output path:', outPath);
  console.log('Prompt length:', VEO_SMOKE_PROMPT.length, 'chars');

  if (!hasKey) {
    console.error('\nFAIL: GOOGLE_GENERATIVE_AI_API_KEY is not set.');
    console.error(
      'Add it to a local .env (server-only). See .env.example. Do not use NEXT_PUBLIC_*.',
    );
    process.exit(1);
  }

  try {
    const result = await generateAndDownloadVeoVideo({
      prompt: VEO_SMOKE_PROMPT,
      downloadPath: outPath,
      model,
      onPoll: ({ elapsedMs, done }) => {
        if (!done) {
          console.log(`… polling Veo operation (${Math.round(elapsedMs / 1000)}s elapsed)`);
        }
      },
    });

    if (!existsSync(result.downloadPath)) {
      console.error('\nFAIL: download path missing after success claim');
      process.exit(1);
    }

    console.log('\nOK: Veo generated a real video.');
    console.log('Model used:', result.model);
    console.log('Operation:', result.operationName ? '(present)' : '(none)');
    console.log('Saved:', result.downloadPath);
    console.log('Size bytes:', result.fileBytes);
    console.log('\nVeo access: YES — this Gemini API key/project can generate Veo videos.');
  } catch (err) {
    const message = formatVeoError(err);
    console.error('\nFAIL:', message);

    if (/not configured/i.test(message)) {
      console.error('Set GOOGLE_GENERATIVE_AI_API_KEY in .env (server-only).');
    } else if (/403|PERMISSION|not (enabled|allowed)|ACCESS_DENIED|quota|billing|not available|UNSUPPORTED|INVALID_ARGUMENT.*model|model.*not found|404/i.test(message)) {
      console.error(
        '\nVeo access: NO or blocked — the Gemini API key/project likely cannot use Veo.',
      );
      console.error('STOPPING per product plan: do not build the homework video UI until Veo works.');
    } else if (/401|API[_ ]?key|UNAUTHENTICATED|authentication/i.test(message)) {
      console.error('Gemini authentication failed — check GOOGLE_GENERATIVE_AI_API_KEY.');
    } else {
      console.error('Provider/API error above. Fix access/quota before continuing the video feature.');
    }
    process.exit(1);
  }
}

void main();

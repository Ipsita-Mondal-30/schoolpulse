/**
 * One-off server-side smoke test for Gemini + generateObject (Today's Recap).
 * Run: npx tsx scripts/test-gemini-recap.ts
 * Never logs GOOGLE_GENERATIVE_AI_API_KEY.
 */

import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const lessonSchema = z.object({
  topic: z.string(),
  explanation: z.string(),
  examples: z.array(z.string()),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.string(),
    }),
  ),
});

const PROMPT =
  'Create a short child-friendly lesson for a Class 1 student about Opposite Words. Give simple examples and 3 quiz questions.';

async function main() {
  const modelId = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const hasKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());

  console.log('--- Gemini Recap smoke test ---');
  console.log('Model:', modelId);
  console.log('GOOGLE_GENERATIVE_AI_API_KEY configured:', hasKey ? 'yes' : 'no');

  if (!hasKey) {
    console.error('FAIL: Set GOOGLE_GENERATIVE_AI_API_KEY in .env (server-only).');
    process.exit(1);
  }

  try {
    const result = await generateObject({
      // @ts-expect-error ai / provider version alignment
      model: google(modelId),
      schema: lessonSchema,
      prompt: PROMPT,
    });

    const validated = lessonSchema.parse(result.object);
    console.log('\n--- Validated structured JSON ---');
    console.log(JSON.stringify(validated, null, 2));
    console.log('\nOK: Gemini auth succeeded, generateObject returned valid schema.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\nFAIL:', message);
    if (/401|403|API key|authentication|permission/i.test(message)) {
      console.error('Gemini authentication likely failed — check GOOGLE_GENERATIVE_AI_API_KEY.');
    }
    process.exit(1);
  }
}

void main();

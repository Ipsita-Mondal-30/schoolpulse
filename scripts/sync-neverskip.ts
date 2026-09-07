#!/usr/bin/env tsx
/**
 * Local NeverSkip sync runner (token fallback).
 * Usage: npx tsx scripts/sync-neverskip.ts
 * Requires DATABASE_URL and NEVERSKIP_TOKEN.
 *
 * Prefer the browser session path when no official API token is available:
 *   npm run neverskip:login
 *   npm run sync:neverskip:browser
 */
import { config } from 'dotenv';
config();

import { NeverSkipClient } from '../lib/neverskip/client';
import { EnvTokenAuth } from '../lib/neverskip/auth';
import { PrismaNeverSkipStore } from '../lib/neverskip/prisma-store';
import { syncNeverSkip } from '../lib/neverskip/sync';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  const client = new NeverSkipClient({ auth: new EnvTokenAuth() });
  const store = new PrismaNeverSkipStore();
  const summary = await syncNeverSkip({ client, store });
  nsLog('Summary:', JSON.stringify(summary));
  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

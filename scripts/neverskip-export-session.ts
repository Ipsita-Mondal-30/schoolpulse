#!/usr/bin/env tsx
/**
 * On a machine with a normal keyboard/display (e.g. a Mac): log in to NeverSkip in a
 * headed window (CAPTCHA by the parent), then write the session to a 0600 file for
 * deploy/neverskip-worker/import-session.sh on the worker. Never prints the session.
 *
 * Usage: npm run neverskip:export-session -- --out <file>
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import { loginNeverSkipSession } from '../lib/neverskip/browser';
import { exportNeverSkipSession } from '../lib/neverskip/session-transfer';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const out = arg('--out');
  if (!out) {
    console.error('Usage: npm run neverskip:export-session -- --out <file>');
    return 1;
  }
  let landed = await exportNeverSkipSession(out);
  if (!landed.startsWith('/default')) {
    const { profileDir } = await loginNeverSkipSession();
    landed = await exportNeverSkipSession(out, profileDir);
  }
  if (landed.startsWith('/default')) {
    console.log(`[SchoolPulse] SESSION EXPORTED to ${out} (mode 0600) — copy it to the worker, then delete it`);
    return 0;
  }
  console.log(`[SchoolPulse] SESSION NOT EXPORTED — portal landed on ${landed}`);
  return 3;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[SchoolPulse] SESSION EXPORT FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });

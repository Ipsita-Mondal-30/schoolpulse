#!/usr/bin/env tsx
/**
 * First-time NeverSkip authentication (headed).
 *
 * Usage: npm run neverskip:login
 *
 * Opens the NeverSkip Parent Portal in a persistent Playwright profile.
 * Log in normally (complete CAPTCHA if shown). The session is saved under
 * .playwright-profile/ (or NEVERSKIP_PROFILE_DIR) — never commit this directory.
 *
 * After login succeeds, later syncs use:
 *   npm run sync:neverskip:browser
 */
import { config } from 'dotenv';
config();

import {
  loginNeverSkipSession,
  NeverSkipSessionExpiredError,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  const { profileDir } = await loginNeverSkipSession();
  nsLog('Login complete. You can close this process; the browser profile is saved.');
  nsLog(`Profile directory (gitignored): ${pathBasenameSafe(profileDir)}`);
  nsLog('Next: npm run sync:neverskip:browser');
}

function pathBasenameSafe(profileDir: string): string {
  // Only show the configured relative folder name when possible — never dump cookies/state.
  const env = process.env.NEVERSKIP_PROFILE_DIR?.trim();
  if (env) return env;
  return '.playwright-profile';
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    process.exit(1);
  }
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

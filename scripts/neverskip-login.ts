#!/usr/bin/env tsx
/**
 * First-time NeverSkip authentication (headed).
 *
 * Usage: npm run neverskip:login
 *
 * Opens the NeverSkip Parent Portal in a persistent Playwright profile.
 * Log in normally (complete CAPTCHA if shown). The session is saved under
 * NEVERSKIP_PROFILE_DIR (worker .env first, then root .env) or .playwright-profile/.
 * Never commit this directory. On a display-less Linux worker use
 * deploy/neverskip-worker/login.sh (VNC over SSH tunnel).
 *
 * After login succeeds, later syncs use:
 *   npm run sync:neverskip:browser
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import fs from 'fs';
import path from 'path';
import {
  LOGIN_TIMESTAMP_FILE,
  loginNeverSkipSession,
  NeverSkipSessionExpiredError,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  const { profileDir } = await loginNeverSkipSession();
  try {
    fs.writeFileSync(
      path.join(profileDir, LOGIN_TIMESTAMP_FILE),
      JSON.stringify({ loggedInAt: new Date().toISOString() }),
    );
  } catch {
    // Session age in auth alerts is best-effort.
  }
  nsLog('Login complete. You can close this process; the browser profile is saved.');
  // Path only — never cookies or storage state.
  nsLog(`Profile directory (gitignored): ${profileDir}`);
  nsLog('Next: npm run sync:neverskip:browser');
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    process.exit(1);
  }
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

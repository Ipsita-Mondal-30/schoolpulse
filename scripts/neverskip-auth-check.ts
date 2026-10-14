#!/usr/bin/env tsx
/**
 * Read-only NeverSkip session check (no data extraction, no DB writes, no login wait).
 * Usage: npm run neverskip:auth-check   (on the worker: deploy/neverskip-worker/auth-check.sh)
 *
 * Exit codes: 0 authenticated, 3 login required / profile missing, 1 check could not run.
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import { checkNeverSkipSession, readNeverSkipLoginTimestamp } from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main(): Promise<number> {
  const result = await checkNeverSkipSession();
  nsLog(`Profile directory: ${result.profileDir}`);
  const loggedInAt = readNeverSkipLoginTimestamp(result.profileDir);
  nsLog(`Last recorded login: ${loggedInAt ?? '(none recorded)'}`);
  if (result.path) nsLog(`Notices page landed on path=${result.path}`);
  if (result.status === 'AUTHENTICATED') {
    nsLog('AUTH CHECK: AUTHENTICATED');
    return 0;
  }
  nsError(`AUTH CHECK: ${result.status} — run deploy/neverskip-worker/login.sh on this host`);
  return 3;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    nsError(`AUTH CHECK: FAILED TO RUN — ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });

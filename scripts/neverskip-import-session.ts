#!/usr/bin/env tsx
/**
 * Worker side of the session transfer: load a session file written by
 * neverskip:export-session into the worker profile, delete the file, then run the
 * read-only auth check. Run via deploy/neverskip-worker/import-session.sh (takes the lock).
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import fs from 'fs';
import path from 'path';
import { LOGIN_TIMESTAMP_FILE, checkNeverSkipSession, resolveNeverSkipProfileDir } from '../lib/neverskip/browser';
import { filterNeverSkipState, importNeverSkipSession, sessionStateCounts } from '../lib/neverskip/session-transfer';

async function main(): Promise<number> {
  const i = process.argv.indexOf('--file');
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run neverskip:import-session -- --file <session file>');
    return 1;
  }
  let state;
  try {
    state = filterNeverSkipState(JSON.parse(fs.readFileSync(file, 'utf8')));
  } finally {
    fs.rmSync(file, { force: true });
  }
  const profileDir = resolveNeverSkipProfileDir();
  console.log(`[SchoolPulse] Importing session (${sessionStateCounts(state)}) into ${profileDir}; source file deleted`);
  await importNeverSkipSession(state, profileDir);

  const check = await checkNeverSkipSession({ profileDir });
  console.log(`[SchoolPulse] Notices page landed on path=${check.path ?? '(none)'}`);
  if (check.status !== 'AUTHENTICATED') {
    console.log(`[SchoolPulse] AUTH CHECK: ${check.status} — imported session was not accepted on this host`);
    return 3;
  }
  fs.writeFileSync(
    path.join(profileDir, LOGIN_TIMESTAMP_FILE),
    JSON.stringify({ loggedInAt: new Date().toISOString(), method: 'session-import' }),
  );
  console.log('[SchoolPulse] AUTH CHECK: AUTHENTICATED');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[SchoolPulse] SESSION IMPORT FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });

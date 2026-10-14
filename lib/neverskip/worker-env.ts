import path from 'path';
import { config } from 'dotenv';

/** Worker-only settings (DATABASE_URL, NEVERSKIP_PROFILE_DIR, ...) — gitignored. */
export const WORKER_ENV_RELATIVE = 'deploy/neverskip-worker/.env';

/**
 * Load env for NeverSkip CLI scripts the same way the shell wrappers do:
 * already-exported vars win, then deploy/neverskip-worker/.env, then the root .env.
 * Keeps `npm run neverskip:login` and run-sync.sh on the same browser profile.
 */
export function loadWorkerEnv(cwd = process.cwd()): void {
  config({ path: path.join(cwd, WORKER_ENV_RELATIVE), quiet: true });
  config({ path: path.join(cwd, '.env'), quiet: true });
}

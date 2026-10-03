/**
 * Worker-side sync alerting: emails admins only when the health state changes,
 * plus one recovery email when it returns to HEALTHY. Statuses and dates only.
 */

import fs from 'fs';
import path from 'path';
import type { SyncHealth } from '@/lib/neverskip/sync-health';
import { sendAlertEmail, type AlertEmail, type SendResult } from './email';

export type AlertState = { key: string; since: string };

export type AlertDecision =
  | { kind: 'none'; key: string }
  | { kind: 'alert' | 'recovery'; key: string; email: AlertEmail };

const ISSUE_TEXT: Record<string, string> = {
  AUTH_EXPIRED: 'NeverSkip login expired — run `npm run neverskip:login` on the worker (CAPTCHA required).',
  STALE_6H: 'No COMPLETE sync for more than 6 hours.',
  REPEATED_FAILURE: 'Two or more consecutive sync runs failed.',
  INCOMPLETE_CRITICAL: 'Critical data incomplete (homework partial, notices page-0 only, or JoL/planner failed).',
};

export function alertStateKey(health: Pick<SyncHealth, 'issues'>): string {
  return health.issues.length ? [...health.issues].sort().join('+') : 'HEALTHY';
}

function sessionAgeLine(lastLoginAt: string | null | undefined, now: Date): string | null {
  if (!lastLoginAt) return null;
  const ms = now.getTime() - new Date(lastLoginAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.round(ms / 3600_000);
  return `NeverSkip session age at failure: ${hours}h (last login ${lastLoginAt})`;
}

export function formatAlertEmail(
  health: SyncHealth,
  kind: 'alert' | 'recovery',
  opts: { now?: Date; lastLoginAt?: string | null } = {},
): AlertEmail {
  const now = opts.now ?? new Date();
  const lines: string[] = [];
  if (kind === 'recovery') {
    lines.push('SchoolPulse NeverSkip sync has recovered.');
  } else {
    lines.push('SchoolPulse NeverSkip sync needs attention:');
    for (const issue of health.issues) lines.push(`- ${ISSUE_TEXT[issue] ?? issue}`);
  }
  lines.push(
    '',
    `Status: ${health.status}`,
    `Auth: ${health.authStatus}`,
    `Last COMPLETE sync: ${health.lastSuccessAt ?? 'never'}`,
    `Last data write: ${health.lastDataWriteAt ?? 'never'}`,
    `Last attempt: ${health.lastAttemptAt ?? 'never'}`,
    `Homework: ${health.homework?.status ?? '—'} · Notices: ${health.notices?.status ?? '—'} · JoL: ${health.jol?.status ?? '—'} · Planner: ${health.plannerStatus ?? '—'}`,
  );
  if (health.issues.includes('AUTH_EXPIRED')) {
    const age = sessionAgeLine(opts.lastLoginAt, now);
    if (age) lines.push(age);
  }
  lines.push('', `Checked at ${now.toISOString()}`);
  const subject =
    kind === 'recovery'
      ? 'SchoolPulse sync recovered'
      : `SchoolPulse sync alert: ${health.issues.join(', ')}`;
  return { subject, text: lines.join('\n') };
}

export function decideAlert(
  prev: AlertState | null,
  health: SyncHealth,
  opts: { now?: Date; lastLoginAt?: string | null } = {},
): AlertDecision {
  const key = alertStateKey(health);
  if (prev?.key === key) return { kind: 'none', key };
  if (key === 'HEALTHY') {
    if (!prev) return { kind: 'none', key };
    return { kind: 'recovery', key, email: formatAlertEmail(health, 'recovery', opts) };
  }
  return { kind: 'alert', key, email: formatAlertEmail(health, 'alert', opts) };
}

export function alertStatePath(cwd = process.cwd()): string {
  const fromEnv = process.env.NEVERSKIP_ALERT_STATE_FILE?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(cwd, 'deploy/neverskip-worker/neverskip-data/alert-state.json');
}

export function readAlertState(file = alertStatePath()): AlertState | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof raw?.key === 'string' ? (raw as AlertState) : null;
  } catch {
    return null;
  }
}

export function writeAlertState(state: AlertState, file = alertStatePath()): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}

/**
 * Evaluate health and send at most one email. State is persisted only after a
 * successful send (or when no email is needed), so an unsent alert retries next run.
 */
export async function applyAlertDecision(
  health: SyncHealth,
  deps: {
    readState: () => AlertState | null;
    writeState: (s: AlertState) => void;
    send: (e: AlertEmail) => Promise<SendResult>;
    now?: Date;
    lastLoginAt?: string | null;
  },
): Promise<{ decision: AlertDecision; result: SendResult | null }> {
  const now = deps.now ?? new Date();
  const decision = decideAlert(deps.readState(), health, { now, lastLoginAt: deps.lastLoginAt });
  if (decision.kind === 'none') {
    if (!deps.readState()) deps.writeState({ key: decision.key, since: now.toISOString() });
    return { decision, result: null };
  }
  const result = await deps.send(decision.email);
  if (result.sent) deps.writeState({ key: decision.key, since: now.toISOString() });
  return { decision, result };
}

export async function runSyncAlertCheck(): Promise<void> {
  const [{ getPrisma }, { loadSyncHealth }, { readNeverSkipLoginTimestamp }] = await Promise.all([
    import('@/lib/prisma'),
    import('@/lib/neverskip/sync-health'),
    import('@/lib/neverskip/browser'),
  ]);
  const health = await loadSyncHealth(getPrisma());
  const { decision } = await applyAlertDecision(health, {
    readState: () => readAlertState(),
    writeState: (s) => writeAlertState(s),
    send: (e) => sendAlertEmail(e),
    lastLoginAt: readNeverSkipLoginTimestamp(),
  });
  console.log(`[SchoolPulse] Alert check: state=${decision.key} action=${decision.kind}`);
}

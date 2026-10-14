import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAlertDecision, decideAlert, type AlertState } from '@/lib/alerts/sync-alerts';
import { sendAlertEmail } from '@/lib/alerts/email';
import type { SyncHealth } from '@/lib/neverskip/sync-health';

const NOW = new Date('2026-10-03T12:00:00Z');

function health(issues: SyncHealth['issues']): SyncHealth {
  return {
    status: issues.includes('AUTH_EXPIRED') ? 'SESSION_EXPIRED' : 'SYNC_SUCCESS',
    authStatus: issues.includes('AUTH_EXPIRED') ? 'SESSION_EXPIRED' : 'AUTHENTICATED',
    databaseWriteStatus: 'OK',
    lastAttemptAt: NOW.toISOString(),
    lastSuccessAt: null,
    lastDataWriteAt: null,
    lastFailureAt: null,
    failureReason: 'secret-free reason',
    homework: null,
    notices: null,
    jol: null,
    plannerStatus: null,
    issues,
    healthy: issues.length === 0,
  };
}

function harness(initial: AlertState | null, sent = true) {
  let state = initial;
  const send = vi.fn(async () => ({ sent }));
  return {
    send,
    get state() {
      return state;
    },
    deps: {
      readState: () => state,
      writeState: (s: AlertState) => {
        state = s;
      },
      send,
      now: NOW,
    },
  };
}

describe('sync alert state transitions', () => {
  it('sends once per state change, not on every run', async () => {
    const h = harness({ key: 'HEALTHY', since: '' });
    await applyAlertDecision(health(['AUTH_EXPIRED']), h.deps);
    await applyAlertDecision(health(['AUTH_EXPIRED']), h.deps);
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.state?.key).toBe('AUTH_EXPIRED');

    await applyAlertDecision(health(['AUTH_EXPIRED', 'STALE_6H']), h.deps);
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it('sends a recovery email when returning to HEALTHY', async () => {
    const h = harness({ key: 'AUTH_EXPIRED', since: '' });
    const { decision } = await applyAlertDecision(health([]), h.deps);
    expect(decision.kind).toBe('recovery');
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.state?.key).toBe('HEALTHY');
  });

  it('first healthy run records state without emailing', async () => {
    const h = harness(null);
    await applyAlertDecision(health([]), h.deps);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.state?.key).toBe('HEALTHY');
  });

  it('keeps state unchanged when the email was not sent so it retries next run', async () => {
    const h = harness({ key: 'HEALTHY', since: '' }, false);
    await applyAlertDecision(health(['REPEATED_FAILURE']), h.deps);
    expect(h.state?.key).toBe('HEALTHY');
    await applyAlertDecision(health(['REPEATED_FAILURE']), h.deps);
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it('auth alert includes session age and no raw payloads', () => {
    const d = decideAlert({ key: 'HEALTHY', since: '' }, health(['AUTH_EXPIRED']), {
      now: NOW,
      lastLoginAt: '2026-10-01T12:00:00Z',
    });
    expect(d.kind).toBe('alert');
    if (d.kind !== 'none') {
      expect(d.email.text).toContain('session age at failure: 48h');
      expect(d.email.text).not.toMatch(/postgres|cookie|token=/i);
    }
  });
});

describe('alert email relay', () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.SUPABASE_ALERT_FUNCTION_URL;
    delete process.env.SUPABASE_ALERT_FUNCTION_KEY;
    delete process.env.ALERT_EMAIL_TO;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('logs "ALERT NOT SENT" and reports not sent when unconfigured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const r = await sendAlertEmail({ subject: 's', text: 't' }, fetchImpl as unknown as typeof fetch);
    expect(r.sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).toContain('ALERT NOT SENT — email unconfigured');
  });

  it('posts {to, subject, text} with Bearer key when configured', async () => {
    process.env.SUPABASE_ALERT_FUNCTION_URL = 'https://x.supabase.co/functions/v1/schoolpulse-sync-alert';
    process.env.SUPABASE_ALERT_FUNCTION_KEY = 'k';
    process.env.ALERT_EMAIL_TO = 'admin@example.com';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const r = await sendAlertEmail({ subject: 's', text: 't' }, fetchImpl as unknown as typeof fetch);
    expect(r.sent).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body))).toEqual({ to: 'admin@example.com', subject: 's', text: 't' });
  });
});

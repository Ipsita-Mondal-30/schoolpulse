/**
 * Admin alert email via the Supabase Edge Function relay
 * (supabase/functions/schoolpulse-sync-alert). Provider secrets live in Supabase.
 */

export type AlertEmail = { subject: string; text: string };

export type SendResult = { sent: boolean; reason?: string };

export function emailConfig(): { url: string; key: string; to: string } | null {
  const url = process.env.SUPABASE_ALERT_FUNCTION_URL?.trim();
  const key = process.env.SUPABASE_ALERT_FUNCTION_KEY?.trim();
  const to = process.env.ALERT_EMAIL_TO?.trim();
  if (!url || !key || !to) return null;
  return { url, key, to };
}

export async function sendAlertEmail(
  email: AlertEmail,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const cfg = emailConfig();
  if (!cfg) {
    console.warn(`[SchoolPulse] ALERT NOT SENT — email unconfigured: ${email.subject}`);
    return { sent: false, reason: 'unconfigured' };
  }
  try {
    const res = await fetchImpl(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({ to: cfg.to, subject: email.subject, text: email.text }),
    });
    if (!res.ok) {
      console.warn(`[SchoolPulse] ALERT NOT SENT — relay HTTP ${res.status}: ${email.subject}`);
      return { sent: false, reason: `http ${res.status}` };
    }
    console.log(`[SchoolPulse] ALERT SENT: ${email.subject}`);
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[SchoolPulse] ALERT NOT SENT — relay error: ${reason}`);
    return { sent: false, reason };
  }
}

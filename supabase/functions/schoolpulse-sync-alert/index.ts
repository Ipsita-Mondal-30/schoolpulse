// SchoolPulse admin sync-alert relay (Supabase Edge Function, Deno).
//
// Deploy:
//   supabase secrets set ALERT_RELAY_KEY=<random> RESEND_API_KEY=<key> ALERT_FROM_EMAIL="SchoolPulse <alerts@yourdomain>"
//   supabase functions deploy schoolpulse-sync-alert --no-verify-jwt
// Worker .env:
//   SUPABASE_ALERT_FUNCTION_URL=https://<project>.supabase.co/functions/v1/schoolpulse-sync-alert
//   SUPABASE_ALERT_FUNCTION_KEY=<same ALERT_RELAY_KEY>
//   ALERT_EMAIL_TO=admin@example.com
//
// If your project already has an email function, point SUPABASE_ALERT_FUNCTION_URL at it instead;
// it must accept POST { to, subject, text } with a Bearer key.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const relayKey = Deno.env.get('ALERT_RELAY_KEY');
  const auth = req.headers.get('authorization') ?? '';
  if (!relayKey || auth !== `Bearer ${relayKey}`) return json(401, { error: 'unauthorized' });

  let payload: { to?: string; subject?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }
  const { to, subject, text } = payload;
  if (!to || !subject || !text) return json(400, { error: 'to, subject, text required' });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('ALERT_FROM_EMAIL');
  if (!resendKey || !from) return json(500, { error: 'email provider not configured' });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      subject: subject.slice(0, 200),
      text: text.slice(0, 5000),
    }),
  });
  if (!res.ok) return json(502, { error: `provider http ${res.status}` });
  return json(200, { ok: true });
});

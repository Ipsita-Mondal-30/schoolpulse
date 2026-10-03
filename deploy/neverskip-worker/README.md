# NeverSkip production worker (persistent Linux host)

This directory packages the **Playwright NeverSkip sync** that must run
**outside Vercel** and **outside GitHub-hosted Actions**.

## Why not GitHub Actions?

GitHub-hosted runners are ephemeral Linux VMs. A Mac-created Chromium profile
restores and launches, but NeverSkip redirects to `/auth/login` (session not
valid on that runner). Do **not** use `.github/workflows/neverskip-sync.yml` as
production sync. See [recommended-disable-github-actions.diff](./recommended-disable-github-actions.diff).

## Architecture

```text
Oracle / persistent Linux host (/home/ubuntu/schoolpulse)
  → NEVERSKIP_PROFILE_DIR=.../deploy/neverskip-worker/neverskip-data/neverskip-profile
  → systemd timer (4h) → deploy/neverskip-worker/run-sync.sh (flock: no overlap)
  → xvfb-run -a + NEVERSKIP_HEADLESS=false  (Incapsula often blocks true headless)
  → normalize / classify / dedupe
  → Neon PostgreSQL (ImportedHomework / ImportedNotice)
  → invalidateSchoolPulseCaches (requires REDIS_URL on the worker = same Redis as Vercel)
  → Vercel SchoolPulse UI (same DATABASE_URL)
```

**Redis (required for fresh parent UI after sync):** set `REDIS_URL` in
`deploy/neverskip-worker/.env` to the **same** Redis used by Vercel. Without it,
Neon updates correctly but parents may see stale cached homework/notices until TTL.

Scheduler: systemd timer every 4h via [run-sync.sh](./run-sync.sh) — see
[systemd/](./systemd/) and section 8. Laptop does **not** need to be on.

Manual NeverSkip login is only required again if the **host** session expires.


## NeverSkip production worker — setup

### 1. Create a persistent Linux host

VPS / home server / always-on machine with Docker (or Node 20 + Playwright).

### 2. Install Docker

Follow Docker Engine docs for your distro. Confirm: `docker compose version`.

### 3. Configure Neon `DATABASE_URL`

```bash
cd deploy/neverskip-worker
cp .env.example .env
# Edit .env — set DATABASE_URL to the same Neon URL Vercel uses.
# Never commit .env.
```

### 4. Mount persistent `/data` volume

Default compose uses Docker volume `neverskip-data` → `/data`.

For easier one-time login on the **same** host, prefer a bind mount:

```bash
sudo mkdir -p /var/lib/schoolpulse/data/neverskip-profile
sudo chown -R "$USER":"$USER" /var/lib/schoolpulse/data
export NEVERSKIP_DATA_DIR=/var/lib/schoolpulse/data
```

Compose maps `${NEVERSKIP_DATA_DIR}:/data`, so the profile is:

`/data/neverskip-profile` inside the container  
= `/var/lib/schoolpulse/data/neverskip-profile` on the host.

### 5. Build the image

```bash
cd deploy/neverskip-worker
docker compose build
```

### 6. One-time interactive login **on this Linux host**

The NeverSkip login is performed **ONCE on the persistent Linux host**, not on
a developer Mac. Do **not** copy a Mac `.playwright-profile` into production.

**Bare metal login (recommended for headed CAPTCHA):**

```bash
cd /path/to/schoolpulse   # repo clone on the Linux host
npm ci
npx playwright install chromium
export NEVERSKIP_PROFILE_DIR=/var/lib/schoolpulse/data/neverskip-profile
npm run neverskip:login
```

Complete NeverSkip login + CAPTCHA in the headed browser. The profile is written
to that directory and must never be committed.

Automated sync **never** attempts login or CAPTCHA bypass.

### 7. Verify one sync (Oracle / xvfb — preferred on this host)

```bash
cd /home/ubuntu/schoolpulse
chmod +x deploy/neverskip-worker/run-sync.sh
# .env must contain DATABASE_URL (same Neon as Vercel)
./deploy/neverskip-worker/run-sync.sh
```

Equivalent one-liner:

```bash
NEVERSKIP_PROFILE_DIR=/home/ubuntu/schoolpulse/deploy/neverskip-worker/neverskip-data/neverskip-profile \
NEVERSKIP_HEADLESS=false xvfb-run -a npm run sync:neverskip:browser
```

Expect: `SYNC STATUS: COMPLETE` (or explicit `INCOMPLETE` / `SESSION_EXPIRED`).
On expiry: headed login **on this host** with the same profile path, then re-run.

Docker one-shot remains available (`docker compose run --rm neverskip-sync`) but is secondary on Oracle when xvfb headed sync is the proven path.

### 8. Scheduler: systemd timer (replaces cron — run exactly one)

```bash
cd /home/ubuntu/schoolpulse
sudo cp deploy/neverskip-worker/systemd/schoolpulse-neverskip-sync.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now schoolpulse-neverskip-sync.timer
systemctl list-timers schoolpulse-neverskip-sync.timer
```

The timer survives SSH/RDP disconnects, closed terminals and reboots (`Persistent=true`
runs a missed slot after boot). `Type=oneshot` + `flock` in `run-sync.sh` prevent overlap.

Migration from cron: wait for one scheduled firing, check
`journalctl -u schoolpulse-neverskip-sync -n 50` and `tail -n 200 /home/ubuntu/neverskip-sync.log`,
**then** remove the crontab line (`crontab -e`; confirm with `crontab -l`). Until then an overlapping
cron run is skipped by the lock (exit 75), never doubled. Manual run: `sudo systemctl start schoolpulse-neverskip-sync`.

Exit codes: `0` COMPLETE, `2` PARTIAL, `1` FAILED / DB error, `3` authentication required, `75` another sync running.
Each run **exits** when finished (no infinite loop). Secrets stay in `deploy/neverskip-worker/.env`.

### 8b. Alerts + health

- Worker emails admins (Supabase Edge Function relay, `supabase/functions/schoolpulse-sync-alert`) only when
  the state changes: auth expired, no COMPLETE sync 6h+, 2+ consecutive failures, incomplete critical data
  (homework partial, notices page-0 only, JoL/planner extraction failed) — plus one recovery email.
  Configure `SUPABASE_ALERT_FUNCTION_URL`, `SUPABASE_ALERT_FUNCTION_KEY`, `ALERT_EMAIL_TO` in `.env`.
  Dedupe state: `neverskip-data/alert-state.json`.
- If the VM itself is down nothing is emailed. Point an external uptime monitor at
  `GET /api/admin/sync-health` with header `x-admin-token: $ADMIN_HEALTH_TOKEN` (HTTP 503 = unhealthy).
- `npm run neverskip:login` writes a login timestamp in the profile dir; auth alerts include the session age.
  Re-login (CAPTCHA) remains a manual step whenever NeverSkip expires the session.

### 8c. Newsletter → Planner / JoL timetable

Each sync downloads new Content Library newsletter PDFs, extracts planner + important dates + JoL timetable
with Gemini (`GOOGLE_GENERATIVE_AI_API_KEY`, optional `NEWSLETTER_GEMINI_MODEL`), validates, and stores them
in Neon (`ImportedNewsletterMonth`, `ImportedJolSchedule`). Invalid extractions keep the last valid data and
raise `plannerStatus=FAILED`. Backfill an existing PDF:
`npx tsx scripts/ingest-newsletter.ts --file <pdf> [--source-id <contentlib id>]`.

### 9. Verify Neon rows

Confirm `ImportedHomework` / `ImportedNotice` update after a successful sync
(idempotent upserts on re-run).

### 10. Vercel reads the same Neon database

SchoolPulse on Vercel uses the same `DATABASE_URL`. TanStack Query staleTime
(~5 minutes) allows the UI to pick up new rows after refetch.

## Failure handling

| Condition | Behavior |
| --- | --- |
| Session expired / profile missing | `SyncRun` AUTHENTICATION_REQUIRED recorded, no data touched, cache kept, alert email, exit 3; **no** auto-login |
| Access Denied / Incapsula | Treated as unauthenticated; fail clearly |
| Incomplete homework pagination / notices page-0 only | `SyncRun` PARTIAL, exit 2, alert (incomplete critical data) |
| FAILED sync | Exit 1; Redis cache **not** invalidated (last-good data stays) |
| DB / Prisma errors | Exit 1 |

Expect safe logs: `SYNC STATUS: COMPLETE` / `PARTIAL` / `FAILED` / `AUTHENTICATION_REQUIRED`.
Ops check from a laptop (no SSH secrets): `npm run check:neverskip-ops`.

Re-auth: on the **same Linux host**, run `npm run neverskip:login` again with
`NEVERSKIP_PROFILE_DIR` pointing at the persistent profile path.

## Urgent production recovery (Oracle VM `152.67.3.1`)

Run on the VM (SSH or RDP). Do **not** delete `neverskip-data/neverskip-profile`.

```bash
crontab -l
tail -100 /home/ubuntu/neverskip-sync.log

cd /home/ubuntu/schoolpulse
git fetch origin && git rev-parse HEAD && git log -1 --oneline
git status
git pull origin main   # only if behind; keep profile

cd /home/ubuntu/schoolpulse/deploy/neverskip-worker
NEVERSKIP_PROFILE_DIR=/home/ubuntu/schoolpulse/deploy/neverskip-worker/neverskip-data/neverskip-profile \
NEVERSKIP_HEADLESS=false \
xvfb-run -a npm run sync:neverskip:browser
```

If logs show `AUTHENTICATION_REQUIRED` / `SESSION_EXPIRED`, re-login on this host, then re-run the sync.

Scheduling must use the systemd timer calling the wrapper (section 8), not a one-off Docker path.

## Optional long-running loop

Not recommended for production (prefer host cron + one-shot). Available as:

```bash
docker compose --profile loop up -d neverskip-worker-loop
```

## Security

- Never commit `.env`, `/data/neverskip-profile`, cookies, or tokens
- Never store the production profile in GitHub secrets
- Never log `DATABASE_URL`, cookies, tokens, or CAPTCHA content

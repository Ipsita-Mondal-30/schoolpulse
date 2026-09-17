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
  → cron → deploy/neverskip-worker/run-sync.sh
  → xvfb-run -a + NEVERSKIP_HEADLESS=false  (Incapsula often blocks true headless)
  → normalize / classify / dedupe
  → Neon PostgreSQL (ImportedHomework / ImportedNotice)
  → Vercel SchoolPulse UI (same DATABASE_URL)
```

Cron: `0 */4 * * *` via [run-sync.sh](./run-sync.sh) — see [crontab.example](./crontab.example).
Laptop does **not** need to be on.

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

### 8. Configure cron (`0 */4 * * *`)

See [crontab.example](./crontab.example). Preferred:

```cron
0 */4 * * * /home/ubuntu/schoolpulse/deploy/neverskip-worker/run-sync.sh >> /home/ubuntu/neverskip-sync.log 2>&1
```

Each run **exits** when finished (no infinite loop). Secrets stay in `deploy/neverskip-worker/.env`.

### 9. Verify Neon rows

Confirm `ImportedHomework` / `ImportedNotice` update after a successful sync
(idempotent upserts on re-run).

### 10. Vercel reads the same Neon database

SchoolPulse on Vercel uses the same `DATABASE_URL`. TanStack Query staleTime
(~5 minutes) allows the UI to pick up new rows after refetch.

## Failure handling

| Condition | Behavior |
| --- | --- |
| Session expired / login redirect | Non-zero exit; `SYNC STATUS: SESSION_EXPIRED`; log manual re-auth; **no** auto-login |
| Access Denied / Incapsula | Treated as unauthenticated; fail clearly |
| Incomplete homework pagination (`total_count` > fetched) | Non-zero exit; `SYNC STATUS: INCOMPLETE` (not “completed with errors”) |
| Notice page probe fails without totals | Treated as end-of-list (not incomplete); newest notices usually on page 0 |
| DB / Prisma errors | Non-zero exit |

Expect safe logs: `SYNC STATUS: COMPLETE` or explicit `INCOMPLETE` / `SESSION_EXPIRED`.
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

Cron must call the wrapper (not a one-off Docker path):

```cron
0 */4 * * * /home/ubuntu/schoolpulse/deploy/neverskip-worker/run-sync.sh >> /home/ubuntu/neverskip-sync.log 2>&1
```

## Optional long-running loop

Not recommended for production (prefer host cron + one-shot). Available as:

```bash
docker compose --profile loop up -d neverskip-worker-loop
```

## Security

- Never commit `.env`, `/data/neverskip-profile`, cookies, or tokens
- Never store the production profile in GitHub secrets
- Never log `DATABASE_URL`, cookies, tokens, or CAPTCHA content

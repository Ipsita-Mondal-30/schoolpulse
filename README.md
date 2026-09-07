# SchoolPulse

Parent-facing Next.js app for daily school schedule, homework, and notices.

## Architecture (production)

| Layer | Where it runs | Role |
| --- | --- | --- |
| SchoolPulse UI | **Vercel Hobby** (Next.js) | Serves pages; reads synced homework/notices from the database |
| Database | **Neon PostgreSQL** | Stores `ImportedHomework` / `ImportedNotice` (and app schema) |
| NeverSkip sync | **External Playwright worker** | Headless browser sync every **4 hours**; persists portal session on disk |

**Why the worker is outside Vercel**

- Vercel Hobby allows **at most one cron job run per day**. A `0 */4 * * *` schedule is rejected with: *Hobby accounts are limited to daily cron jobs*.
- Playwright needs a real Chromium process and a **persistent browser profile**. That cannot run inside a Vercel serverless function.

This repo **does not** ship a `vercel.json` cron. Do not re-add a sub-daily Vercel cron.

## Getting Started (local UI)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## NeverSkip sync (browser session)

SchoolPulse imports homework and notices from the NeverSkip Parent Portal using a **normal authenticated browser session** (Playwright). CAPTCHA and login are never bypassed.

### First time — authenticate once

```bash
npm run neverskip:login
```

1. Playwright opens NeverSkip in a **headed** browser.
2. Log in normally in the portal (complete CAPTCHA if shown).
3. When authentication succeeds, the session is saved under `.playwright-profile/` (or `NEVERSKIP_PROFILE_DIR`).
4. The login process exits cleanly.

### One-shot headless sync

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" npm run sync:neverskip:browser
```

This reuses the persisted Playwright profile, opens NeverSkip headlessly, captures homework + notice API responses (including homework pagination), then runs normalize → classify → dedupe → Prisma persistence.

### Long-running worker (every 4 hours)

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" npm run worker:neverskip
```

Defaults:

- Interval: **4 hours** (`NEVERSKIP_SYNC_INTERVAL_HOURS=4`)
- Runs a sync on process start (`NEVERSKIP_WORKER_RUN_ON_START=true`)
- Headless Playwright (`NEVERSKIP_HEADLESS` unset/true)

If the session has expired you will see:

```text
[SchoolPulse] NeverSkip session expired
[SchoolPulse] Manual re-authentication required
```

Then run `npm run neverskip:login` again and restart the worker. Do not commit `.playwright-profile/` — it contains sensitive session data and is listed in `.gitignore`.

Optional token-based sync (`npm run sync:neverskip` + `NEVERSKIP_TOKEN`, or authenticated `GET/POST /api/cron/neverskip-sync`) remains available as a fallback adapter and is separate from the browser profile workflow. It is **not** used for the production 4-hour schedule.

## Production deployment

Use your Neon connection string as `DATABASE_URL` in **both** Vercel and the worker.

### 1) Database (Neon)

1. Create a Neon Postgres project.
2. Copy the connection string (include `sslmode=require`).
3. From this repo (with `DATABASE_URL` set):

```bash
npx prisma migrate deploy
```

### 2) Next.js app (Vercel Hobby)

1. Import **https://github.com/Ipsita-Mondal-30/schoolpulse.git** into Vercel (branch `main`).
2. Set environment variables in the Vercel project (at least):
   - `DATABASE_URL` — Neon URL
   - Optional: `NEXT_PUBLIC_UPDATES_SHEET_URL`, `OPENAI_API_KEY`, `CRON_SECRET`, etc. (see `.env.example`)
3. Deploy. Confirm there is **no** `vercel.json` cron schedule in the repo.
4. Vercel hosts the UI only — it does **not** run Playwright.

### 3) NeverSkip worker (required for 4-hour sync)

Pick **one** of the options below on a machine that stays on (VPS, always-on laptop, home server, etc.).

#### Option A — Docker Compose (recommended)

```bash
cd deploy/neverskip-worker
# Create a local .env next to docker-compose.yml (never commit it):
#   DATABASE_URL=postgresql://...
docker compose up -d --build
```

Persistent session storage: Docker volume `neverskip-profile` mounted at `/data/neverskip-profile`.

**Seed the Playwright session into the volume** (after a successful host login):

```bash
# On a machine with a display:
NEVERSKIP_PROFILE_DIR=./.playwright-profile npm run neverskip:login

# Copy profile into the running compose volume (example):
docker run --rm -v schoolpulse_neverskip-profile:/data -v "$PWD/.playwright-profile:/src:ro" alpine \
  sh -c 'mkdir -p /data && cp -a /src/. /data/'
docker compose -f deploy/neverskip-worker/docker-compose.yml restart
```

(Adjust the volume name with `docker volume ls` if needed.)

#### Option B — Node worker process + process manager

```bash
npm install
npx playwright install chromium
export DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
export NEVERSKIP_PROFILE_DIR="/var/lib/schoolpulse/neverskip-profile"
export NEVERSKIP_SYNC_INTERVAL_HOURS=4
npm run neverskip:login          # once, headed
npm run worker:neverskip         # long-running; use systemd/pm2 to keep alive
```

#### Option C — system crontab (one-shot every 4 hours)

See `deploy/neverskip-worker/crontab.example`. Example:

```cron
0 */4 * * * cd /path/to/schoolpulse && /usr/bin/env DATABASE_URL="..." NEVERSKIP_HEADLESS=true NEVERSKIP_PROFILE_DIR="/path/to/.playwright-profile" /usr/bin/npm run sync:neverskip:browser >> /var/log/neverskip-sync.log 2>&1
```

### 4) Manual re-authentication

When the worker logs session expiry (exit code `2`):

1. On the worker host: `npm run neverskip:login`
2. Complete NeverSkip login + CAPTCHA in the headed browser
3. Restart the worker (`docker compose restart` or restart the systemd/pm2 process)

## Environment variables

Copy `.env.example` → `.env` locally. **Never commit** `.env`, `.playwright-profile/`, tokens, or database passwords.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Vercel + worker | Neon in production |
| `NEVERSKIP_PROFILE_DIR` | worker / login / sync | Default `.playwright-profile` |
| `NEVERSKIP_SYNC_INTERVAL_HOURS` | `worker:neverskip` | Default `4` |
| `NEVERSKIP_SYNC_INTERVAL_MS` | `worker:neverskip` | Overrides hours if set |
| `NEVERSKIP_WORKER_RUN_ON_START` | `worker:neverskip` | Default `true` |
| `NEVERSKIP_HEADLESS` | browser sync | Default headless; set `false` to watch |
| `CRON_SECRET` | optional HTTP token sync | Not a Vercel Cron schedule |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run neverskip:login` | Headed one-time portal login; persists profile |
| `npm run sync:neverskip:browser` | One-shot headless browser sync |
| `npm run worker:neverskip` | Long-running 4-hour Playwright worker |
| `npm run sync:neverskip` | Optional token API sync |
| `npm run test:unit` | Vitest unit tests |
| `npm run build` | `prisma generate` + Next.js build |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel deployment](https://nextjs.org/docs/app/building-your-application/deploying)

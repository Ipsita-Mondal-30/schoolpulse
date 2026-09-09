# SchoolPulse

Parent-facing Next.js app for daily school schedule, homework, and notices.

## Architecture (production)

| Layer | Where it runs | Role |
| --- | --- | --- |
| SchoolPulse UI | **Vercel Hobby** (Next.js) | Serves pages; reads synced homework/notices from the database |
| Database | **Neon PostgreSQL** | Stores `ImportedHomework` / `ImportedNotice` (and app schema) |
| NeverSkip sync | **Persistent Linux host** (Docker + cron) | Headless browser sync every **4 hours**; profile on host disk |

**Why the worker is outside Vercel (and GitHub Actions)**

- Vercel Hobby allows **at most one cron job run per day**. A `0 */4 * * *` schedule is rejected with: *Hobby accounts are limited to daily cron jobs*.
- Playwright needs a real Chromium process and a **persistent browser profile**. That cannot run inside a Vercel serverless function.
- GitHub-hosted Actions runners are ephemeral and cannot reliably keep a NeverSkip authenticated session (login redirect). Use a **persistent Linux host** instead.

This repo **does not** ship a `vercel.json` cron. Do not re-add a sub-daily Vercel cron.

## Getting Started (local UI)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## NeverSkip sync (browser session)

SchoolPulse imports homework and notices from the NeverSkip Parent Portal using a
**normal authenticated browser session** (Playwright). CAPTCHA and login are never bypassed.

**Production:** run sync on a **persistent Linux host** with a profile created **on that host**.
See [deploy/neverskip-worker/README.md](deploy/neverskip-worker/README.md).

**Not production:** GitHub-hosted Actions cannot keep a valid NeverSkip session (ephemeral
Linux runners + non-portable Mac Chromium profiles). Do not rely on
`.github/workflows/neverskip-sync.yml` for the 4-hour schedule.

### First time — authenticate once (on the same machine that will sync)

```bash
export NEVERSKIP_PROFILE_DIR=/var/lib/schoolpulse/data/neverskip-profile   # example on Linux host
npm run neverskip:login
```

1. Playwright opens NeverSkip in a **headed** browser.
2. Log in normally in the portal (complete CAPTCHA if shown).
3. When authentication succeeds, the session is saved under `NEVERSKIP_PROFILE_DIR`
   (default `.playwright-profile/` for local experiments).
4. The login process exits cleanly. Automated sync never attempts login.

### One-shot headless sync

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" \
NEVERSKIP_HEADLESS=true \
NEVERSKIP_PROFILE_DIR=/var/lib/schoolpulse/data/neverskip-profile \
npm run sync:neverskip:browser
```

This reuses the persisted Playwright profile, opens NeverSkip headlessly, captures
homework + notice API responses (including homework pagination), then runs
normalize → classify → dedupe → Prisma persistence, then **exits**.

### Production schedule (every 4 hours)

Prefer **host cron** + one-shot sync (exits each run):

```cron
0 */4 * * * cd /opt/schoolpulse/deploy/neverskip-worker && docker compose run --rm neverskip-sync >> /var/log/neverskip-sync.log 2>&1
```

See `deploy/neverskip-worker/crontab.example`.

Optional long-running loop (`npm run worker:neverskip`) remains available but is **not**
the recommended production path.

If the session has expired you will see:

```text
[SchoolPulse] NeverSkip session expired
[SchoolPulse] Manual re-authentication required
```

Then run `npm run neverskip:login` again **on the same Linux host** and retry sync.
Do not commit the profile directory — it contains sensitive session data (`.gitignore`).

Optional token-based sync (`npm run sync:neverskip` + `NEVERSKIP_TOKEN`, or authenticated
`GET/POST /api/cron/neverskip-sync`) remains a separate fallback adapter. It is **not**
used for the production 4-hour schedule.


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

**Required:** a machine that stays on (VPS / home server). Full steps:
[deploy/neverskip-worker/README.md](deploy/neverskip-worker/README.md).

Summary:

1. Install Docker on the **persistent Linux host**.
2. Set `DATABASE_URL` in `deploy/neverskip-worker/.env` (Neon; never commit).
3. Mount persistent data at `/data` (`NEVERSKIP_PROFILE_DIR=/data/neverskip-profile`).
4. On **that Linux host** (not a Mac): `NEVERSKIP_PROFILE_DIR=... npm run neverskip:login`.
5. Verify: `docker compose run --rm neverskip-sync`.
6. Cron: `0 */4 * * *` → `docker compose run --rm neverskip-sync` (exits each run).
7. Verify Neon rows; Vercel UI uses the same Neon database.

Do **not** copy a Mac Playwright profile into the Linux worker.
Do **not** use GitHub Actions as the production NeverSkip browser worker.

### 4) Manual re-authentication

When sync logs session expiry:

1. On the **worker Linux host**: `npm run neverskip:login` with the same `NEVERSKIP_PROFILE_DIR`
2. Complete NeverSkip login + CAPTCHA in the headed browser
3. Re-run one sync (or wait for the next cron tick)

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

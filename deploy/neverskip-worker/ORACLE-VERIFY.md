# Oracle worker verification (homework / notices / JOL)

SSH from this Mac to `ubuntu@152.67.3.1` requires a private key that is not present locally.
Until SSH works, treat Oracle cron / production xvfb sync as **NOT VERIFIED**.

## Exact commands on the VM

```bash
# 1) Confirm crontab (expect run-sync.sh every 4h)
crontab -l

# 2) Pull latest code (preserve profile dirs)
cd /home/ubuntu/schoolpulse
git pull
# Keep: neverskip-data/neverskip-profile (do not delete)

# 3) Manual production sync (headed via xvfb — Incapsula often blocks true headless)
cd /home/ubuntu/schoolpulse/deploy/neverskip-worker
NEVERSKIP_PROFILE_DIR=/home/ubuntu/schoolpulse/neverskip-data/neverskip-profile \
NEVERSKIP_HEADLESS=false \
  xvfb-run -a npm run sync:neverskip:browser

# 4) Tail safe logs (no tokens/cookies)
tail -n 80 /home/ubuntu/neverskip-sync.log
```

Confirm Neon after sync: recent homework (e.g. 17-Sep Bitiya), recent notices, and `ImportedJolItem` rows from `fetchcontentlib`.

## JoL II timetable document (required on Oracle)

The newsletter PDF is gitignored. On the worker host ensure one of:

```bash
mkdir -p /home/ubuntu/schoolpulse/deploy/neverskip-worker/neverskip-data/documents
# copy the Sep 2026 Grade 1 newsletter PDF into that folder as:
#   grade1-newsletter-september-2026.pdf
```

or `NEVERSKIP_JOL_TT_PDF=/absolute/path/to/grade1-newsletter-september-2026.pdf`, or an authenticated Content Library download when NeverSkip exposes the newsletter URL.

Missing PDF → `jolTimetable=SKIPPED_NO_SOURCE` (last-good `ImportedJolSchedule` preserved).

## Timetable / calendar (2026-09-21)

SchoolPulse syncs `POST /parentweb/lms/fetchcalenderapi` (Calendar page). For Class I parent session this returns `D: []` (no structured events). There is **no** NeverSkip timetable menu/API. JoL Dates + Timetable + Planner read `ImportedJolSchedule` / `ImportedScheduleEvent` via `loadCanonicalSchedule()` — not static JSON.

Homework unique &lt; total_count (e.g. 134/137) is **`PARTIAL`** (exit 0 from browser sync); notices/JOL/timetable still upsert. Only hard failures exit non-zero.

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

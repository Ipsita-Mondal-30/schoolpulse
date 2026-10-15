#!/usr/bin/env bash
# NeverSkip sync on the parent's Mac, scheduled by launchd (see install-launchd.sh).
# Uses the repo's .playwright-profile (the session created by `npm run neverskip:login`)
# and the root .env. Only one scheduler may be active: keep the Oracle cron disabled.
#
# Exit codes: 0 COMPLETE, 2 PARTIAL, 1 FAILED, 3 authentication required,
#             75 another sync or login is using the profile.
#
# Never prints DATABASE_URL, cookies, or tokens.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NEVERSKIP_PROFILE_DIR="${REPO_ROOT}/.playwright-profile"
# The portal rejects headless Chromium.
export NEVERSKIP_HEADLESS=false
export NEVERSKIP_VIDEO_JOBS_PER_RUN="${NEVERSKIP_VIDEO_JOBS_PER_RUN:-0}"

LOCK_DIR="${HOME}/Library/Caches/schoolpulse-neverskip-sync.lock"
mkdir -p "$(dirname "$LOCK_DIR")"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
    echo "[SchoolPulse] SYNC SKIPPED $(date '+%F %T %Z') — sync pid ${holder} still running"
    exit 75
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi
echo $$ >"$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

if pgrep -f "user-data-dir=${NEVERSKIP_PROFILE_DIR}" >/dev/null 2>&1; then
  echo "[SchoolPulse] SYNC SKIPPED $(date '+%F %T %Z') — a browser (login or manual sync) is using the profile"
  exit 75
fi

echo "[SchoolPulse] Mac sync start $(date '+%F %T %Z') profile=${NEVERSKIP_PROFILE_DIR}"
set +e
caffeinate -i npm run --silent sync:neverskip:browser
code=$?
set -e
echo "[SchoolPulse] Mac sync exit=${code} $(date '+%F %T %Z')"
exit "$code"

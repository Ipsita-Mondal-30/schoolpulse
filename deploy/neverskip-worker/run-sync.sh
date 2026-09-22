#!/usr/bin/env bash
# Production NeverSkip sync for the Oracle/Linux worker host.
# Cron should call this script — do not embed secrets in crontab.
#
# Example crontab (every 4 hours):
#   0 */4 * * * /home/ubuntu/schoolpulse/deploy/neverskip-worker/run-sync.sh >> /home/ubuntu/neverskip-sync.log 2>&1
#
# Never prints DATABASE_URL, cookies, or tokens.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${WORKER_DIR}/.env"
PROFILE_DIR="${NEVERSKIP_PROFILE_DIR:-${WORKER_DIR}/neverskip-data/neverskip-profile}"

cd "$REPO_ROOT"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[SchoolPulse] SYNC STATUS: FAILED — DATABASE_URL missing (set in deploy/neverskip-worker/.env)"
  exit 1
fi

if [[ ! -d "$PROFILE_DIR" ]]; then
  echo "[SchoolPulse] SYNC STATUS: AUTHENTICATION_REQUIRED — profile dir missing: $(basename "$PROFILE_DIR")"
  echo "[SchoolPulse] On this host run: NEVERSKIP_PROFILE_DIR=$PROFILE_DIR npm run neverskip:login"
  exit 1
fi

export NEVERSKIP_PROFILE_DIR="$PROFILE_DIR"
export NEVERSKIP_HEADLESS="${NEVERSKIP_HEADLESS:-false}"

echo "[SchoolPulse] NeverSkip sync wrapper start profile=$(basename "$PROFILE_DIR") headless=$NEVERSKIP_HEADLESS"

if command -v xvfb-run >/dev/null 2>&1; then
  exec xvfb-run -a npm run sync:neverskip:browser
fi

echo "[SchoolPulse] xvfb-run not found — running without virtual display (may fail headless)"
exec npm run sync:neverskip:browser

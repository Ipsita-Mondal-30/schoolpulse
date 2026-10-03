#!/usr/bin/env bash
# Production NeverSkip sync for the Oracle/Linux worker host.
# Scheduled by systemd (deploy/neverskip-worker/systemd/) — do not also run it from cron.
#
# Exit codes: 0 COMPLETE, 2 PARTIAL, 1 FAILED / DB error, 3 authentication required,
#             75 another sync already running (lock busy).
#
# Never prints DATABASE_URL, cookies, or tokens.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${WORKER_DIR}/.env"
PROFILE_DIR="${NEVERSKIP_PROFILE_DIR:-${WORKER_DIR}/neverskip-data/neverskip-profile}"
LOCK_FILE="${WORKER_DIR}/neverskip-data/sync.lock"

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

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SchoolPulse] SYNC SKIPPED — another sync is already running"
  exit 75
fi

# Missing profile is recorded as AUTHENTICATION_REQUIRED by the sync script itself (exit 3).
export NEVERSKIP_PROFILE_DIR="$PROFILE_DIR"
export NEVERSKIP_HEADLESS="${NEVERSKIP_HEADLESS:-false}"

echo "[SchoolPulse] NeverSkip sync wrapper start $(date -u +%Y-%m-%dT%H:%M:%SZ) profile=$(basename "$PROFILE_DIR") headless=$NEVERSKIP_HEADLESS"

set +e
if command -v xvfb-run >/dev/null 2>&1; then
  xvfb-run -a npm run --silent sync:neverskip:browser
else
  echo "[SchoolPulse] xvfb-run not found — running without virtual display (may fail headless)"
  npm run --silent sync:neverskip:browser
fi
code=$?
set -e

echo "[SchoolPulse] NeverSkip sync wrapper exit=${code}"
exit "$code"

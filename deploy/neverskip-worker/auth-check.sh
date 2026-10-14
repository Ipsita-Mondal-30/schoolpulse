#!/usr/bin/env bash
# Read-only NeverSkip session check with the same profile, lock and display mode as run-sync.sh.
# Exit codes: 0 authenticated, 3 login required, 1 could not run, 75 sync/login in progress.
set -euo pipefail

# shellcheck source=deploy/neverskip-worker/env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SchoolPulse] AUTH CHECK SKIPPED — a sync or login is using the profile; retry shortly"
  exit 75
fi

export NEVERSKIP_HEADLESS="${NEVERSKIP_HEADLESS:-false}"
set +e
if [[ -n "${DISPLAY:-}" ]] || ! command -v xvfb-run >/dev/null 2>&1; then
  npm run --silent neverskip:auth-check
else
  xvfb-run -a npm run --silent neverskip:auth-check
fi
code=$?
set -e
exit "$code"

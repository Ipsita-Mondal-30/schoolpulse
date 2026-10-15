#!/usr/bin/env bash
# Load a NeverSkip session exported on another machine (npm run neverskip:export-session)
# into the worker profile, delete the file, and verify it with the auth check.
# Usage: ./deploy/neverskip-worker/import-session.sh [session-file]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

SESSION_FILE="${1:-${WORKER_DIR}/neverskip-data/session-import.json}"
if [[ ! -f "$SESSION_FILE" ]]; then
  echo "[SchoolPulse] Session file not found: ${SESSION_FILE}"
  exit 1
fi
chmod 600 "$SESSION_FILE"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SchoolPulse] A sync or login owns the browser profile — retry when it finishes"
  exit 75
fi

export NEVERSKIP_HEADLESS="${NEVERSKIP_HEADLESS:-false}"
if [[ -n "${DISPLAY:-}" ]]; then
  npm run --silent neverskip:import-session -- --file "$SESSION_FILE"
else
  xvfb-run -a npm run --silent neverskip:import-session -- --file "$SESSION_FILE"
fi

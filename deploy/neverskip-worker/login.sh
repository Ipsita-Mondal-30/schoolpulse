#!/usr/bin/env bash
# One-time NeverSkip login on a display-less Linux worker, viewed over VNC through an SSH tunnel.
# You log in normally in the portal (CAPTCHA included); nothing is automated or bypassed.
#
#   ./deploy/neverskip-worker/login.sh            start virtual display + VNC, open portal login
#   ./deploy/neverskip-worker/login.sh --status   list browser profile folders (read-only)
#
# VNC listens on localhost only; reach it with:  ssh -N -L 5901:localhost:5901 ubuntu@<vm>
# Exit codes: 0 logged in and verified, 3 not authenticated, 1 setup error, 75 sync running.
set -euo pipefail

# shellcheck source=deploy/neverskip-worker/env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"

profile_status() {
  echo "[SchoolPulse] Configured profile (login + sync): ${NEVERSKIP_PROFILE_DIR}"
  local seen="" d
  local candidates=(
    "$NEVERSKIP_PROFILE_DIR"
    "${REPO_ROOT}/.playwright-profile"
    "${WORKER_DIR}/neverskip-data/neverskip-profile"
  )
  if [[ -d "${WORKER_DIR}/schoolpulse" ]]; then
    while IFS= read -r d; do candidates+=("$d"); done < <(
      find "${WORKER_DIR}/schoolpulse" -maxdepth 5 -type d \( -name '.playwright-profile' -o -name 'neverskip-profile' \) 2>/dev/null
    )
  fi
  for d in "${candidates[@]}"; do
    [[ "$seen" == *"|$d|"* ]] && continue
    seen="${seen}|$d|"
    if [[ ! -d "$d" ]]; then
      echo "  - $d  (missing)"
      continue
    fi
    local cookies="(no cookie store)" login="(no login recorded)" marker=""
    [[ -f "$d/Default/Cookies" ]] && cookies="cookies modified $(stat -c %y "$d/Default/Cookies" | cut -d. -f1)"
    [[ -f "$d/schoolpulse-login.json" ]] && login="$(tr -d '\n' < "$d/schoolpulse-login.json")"
    [[ "$d" == "$NEVERSKIP_PROFILE_DIR" ]] && marker="  <- used by login and sync"
    echo "  - $d  ${cookies}  ${login}${marker}"
  done
}

if [[ "${1:-}" == "--status" ]]; then
  profile_status
  exit 0
fi

for bin in Xvfb x11vnc; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[SchoolPulse] Missing $bin — install once with: sudo apt-get install -y xvfb x11vnc"
    exit 1
  fi
done

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SchoolPulse] A sync is running and owns the browser profile — retry when it finishes"
  exit 75
fi

LOGIN_DISPLAY="${NEVERSKIP_LOGIN_DISPLAY:-:98}"
VNC_PORT="${NEVERSKIP_VNC_PORT:-5901}"
VNC_PASS_FILE="$(mktemp)"
VNC_PASS="$(head -c 256 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-8)"
XVFB_PID=""
VNC_PID=""

cleanup() {
  [[ -n "$VNC_PID" ]] && kill "$VNC_PID" 2>/dev/null || true
  [[ -n "$XVFB_PID" ]] && kill "$XVFB_PID" 2>/dev/null || true
  rm -f "$VNC_PASS_FILE"
}
trap cleanup EXIT INT TERM

x11vnc -storepasswd "$VNC_PASS" "$VNC_PASS_FILE" >/dev/null 2>&1
Xvfb "$LOGIN_DISPLAY" -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
XVFB_PID=$!
sleep 2
x11vnc -display "$LOGIN_DISPLAY" -localhost -rfbport "$VNC_PORT" -rfbauth "$VNC_PASS_FILE" \
  -forever -shared -quiet -o /dev/null >/dev/null 2>&1 &
VNC_PID=$!
sleep 1

echo "[SchoolPulse] Profile used by login and sync: ${NEVERSKIP_PROFILE_DIR}"
echo "[SchoolPulse] On your Mac, in a new terminal:"
echo "    ssh -N -L ${VNC_PORT}:localhost:${VNC_PORT} ubuntu@<this-vm-ip>"
echo "    open vnc://localhost:${VNC_PORT}      (one-time VNC password: ${VNC_PASS})"
export NEVERSKIP_LOGIN_TIMEOUT_MS="${NEVERSKIP_LOGIN_TIMEOUT_MS:-1200000}"
echo "[SchoolPulse] Log in to NeverSkip in that window (complete CAPTCHA). Waiting up to $((NEVERSKIP_LOGIN_TIMEOUT_MS / 60000)) minutes…"

export DISPLAY="$LOGIN_DISPLAY"
export NEVERSKIP_HEADLESS=false
set +e
npm run --silent neverskip:login
login_code=$?
set -e
if [[ "$login_code" -ne 0 ]]; then
  echo "[SchoolPulse] LOGIN NOT COMPLETED (exit ${login_code}) — nothing was synced"
  exit 3
fi

echo "[SchoolPulse] Verifying the saved session with a fresh browser…"
set +e
npm run --silent neverskip:auth-check
check_code=$?
set -e
exit "$check_code"

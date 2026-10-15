#!/usr/bin/env bash
# Install / inspect / remove the Mac LaunchAgent that runs deploy/mac/run-sync.sh
# at 00, 04, 08, 12, 16 and 20 local time. A run missed while the Mac sleeps
# starts once on wake. Nothing runs while the Mac is shut down or logged out.
#
# Run it from a checkout outside ~/Documents, ~/Desktop and ~/Downloads: macOS privacy
# controls stop launchd jobs from reading those folders. That checkout needs its own
# .env and .playwright-profile; run `npm run neverskip:login` there when the session expires.
#
#   deploy/mac/install-launchd.sh            install (or reinstall) and load
#   deploy/mac/install-launchd.sh --run-now  trigger one run immediately
#   deploy/mac/install-launchd.sh --status   show launchd state and the log tail
#   deploy/mac/install-launchd.sh --uninstall

set -euo pipefail

LABEL="com.schoolpulse.neverskip-sync"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/schoolpulse-neverskip-sync.log"
DOMAIN="gui/$(id -u)"

case "${1:-install}" in
  --status)
    launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null | grep -E "state|last exit code|runs" || echo "not loaded"
    echo "--- ${LOG}"
    tail -n 20 "$LOG" 2>/dev/null || echo "(no log yet)"
    exit 0
    ;;
  --run-now)
    launchctl kickstart "${DOMAIN}/${LABEL}"
    echo "Started; follow with: tail -f \"${LOG}\""
    exit 0
    ;;
  --uninstall)
    launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed ${LABEL}"
    exit 0
    ;;
  install)
    case "$REPO_ROOT" in
      "${HOME}/Documents"/* | "${HOME}/Desktop"/* | "${HOME}/Downloads"/*)
        echo "Refusing: ${REPO_ROOT} is in a macOS-protected folder that launchd jobs cannot read." >&2
        echo "Clone the repo elsewhere (e.g. ~/schoolpulse-worker) and install from there." >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "usage: $0 [--status|--run-now|--uninstall]" >&2
    exit 64
    ;;
esac

chmod +x "${REPO_ROOT}/deploy/mac/run-sync.sh"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

intervals=""
for hour in 0 4 8 12 16 20; do
  intervals+="    <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>0</integer></dict>
"
done

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${REPO_ROOT}/deploy/mac/run-sync.sh</string>
  </array>
  <key>WorkingDirectory</key><string>${REPO_ROOT}</string>
  <key>StartCalendarInterval</key>
  <array>
${intervals}  </array>
  <key>RunAtLoad</key><false/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Installed ${LABEL}: runs at 00/04/08/12/16/20 local time; log ${LOG}"

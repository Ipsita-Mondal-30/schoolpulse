#!/usr/bin/env bash
# Package a minimal NeverSkip Playwright session for GitHub Actions.
#
# Output (never printed to the terminal):
#   .neverskip-profile.b64
#
# Usage (after local headed login):
#   npm run neverskip:login
#   ./scripts/package-neverskip-profile.sh
#
# Then paste the contents of .neverskip-profile.b64 into the
# NEVERSKIP_PROFILE_B64 GitHub Actions secret (do not commit the file).
#
# GitHub Actions repository secrets have a maximum size of 48 KB (49152 bytes).
# This script packs only authentication-relevant Chromium files and rejects
# oversized output.
set -euo pipefail

# Never enable xtrace — profile paths must not dump sensitive content.
set +x

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE_SRC="${NEVERSKIP_PROFILE_DIR:-.playwright-profile}"
# Resolve relative paths against repo root
if [[ "$PROFILE_SRC" != /* ]]; then
  PROFILE_SRC="$ROOT_DIR/$PROFILE_SRC"
fi

OUT_B64="$ROOT_DIR/.neverskip-profile.b64"
OUT_TGZ="$ROOT_DIR/.neverskip-profile.tgz"
EXPORT_DIR="$ROOT_DIR/.neverskip-profile-export"
# GitHub Actions repository secret maximum size
MAX_B64_BYTES=49152

if [[ ! -d "$PROFILE_SRC" ]]; then
  echo "ERROR: Playwright profile directory not found: $PROFILE_SRC" >&2
  echo "Run: npm run neverskip:login" >&2
  exit 1
fi

if [[ -z "$(find "$PROFILE_SRC" -type f 2>/dev/null | head -n 1)" ]]; then
  echo "ERROR: Playwright profile directory is empty: $PROFILE_SRC" >&2
  echo "Run: npm run neverskip:login" >&2
  exit 1
fi

rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR/Default"

copy_file() {
  local rel="$1"
  local src="$PROFILE_SRC/$rel"
  local dst="$EXPORT_DIR/$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
}

copy_dir() {
  local rel="$1"
  local src="$PROFILE_SRC/$rel"
  local dst="$EXPORT_DIR/$rel"
  if [[ -d "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
  fi
}

# Minimal auth-relevant Chromium profile files only (no caches / shaders / CRX).
copy_file "Local State"
copy_file "Default/Cookies"
copy_file "Default/Cookies-journal"
copy_file "Default/Preferences"
copy_file "Default/Login Data"
copy_file "Default/Login Data-journal"
copy_file "Default/Network Persistent State"
copy_dir "Default/Local Storage"
copy_dir "Default/Session Storage"
copy_dir "Default/Sessions"
copy_dir "Default/WebStorage"

FILE_COUNT="$(find "$EXPORT_DIR" -type f | wc -l | tr -d ' ')"
if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "ERROR: No auth files found under $PROFILE_SRC" >&2
  echo "Expected Cookies / Local Storage / Session Storage after login." >&2
  exit 1
fi

# Create gzip tarball with paths relative to export root (./Local State, ./Default/...)
tar -C "$EXPORT_DIR" -czf "$OUT_TGZ" .
# Write base64 to file only — never echo the payload
base64 < "$OUT_TGZ" > "$OUT_B64"

B64_SIZE="$(wc -c < "$OUT_B64" | tr -d ' ')"
TGZ_SIZE="$(wc -c < "$OUT_TGZ" | tr -d ' ')"

echo "Packaged NeverSkip profile (minimal auth set)."
echo "  Source:     $PROFILE_SRC"
echo "  Files:      $FILE_COUNT"
echo "  Archive:    .neverskip-profile.tgz (${TGZ_SIZE} bytes)"
echo "  Secret file:.neverskip-profile.b64 (${B64_SIZE} bytes)"
echo "  Limit:      ${MAX_B64_BYTES} bytes (GitHub Actions secret max 48 KB)"

if [[ "$B64_SIZE" -ge "$MAX_B64_BYTES" ]]; then
  echo "ERROR: Encoded profile is too large for a GitHub Actions secret (${B64_SIZE} >= ${MAX_B64_BYTES})." >&2
  echo "Re-login with a fresh profile or trim unused storage, then retry." >&2
  exit 1
fi

echo "OK: size within limit."
echo "Next: add the contents of .neverskip-profile.b64 as GitHub secret NEVERSKIP_PROFILE_B64"
echo "Do NOT commit .neverskip-profile.b64 / .neverskip-profile.tgz / .neverskip-profile-export/"

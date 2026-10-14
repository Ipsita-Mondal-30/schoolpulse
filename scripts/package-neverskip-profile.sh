#!/usr/bin/env bash
# Package a minimal NeverSkip Playwright session for GitHub Actions.
#
# Output (never printed to the terminal):
#   .neverskip-profile.b64
#   .neverskip-profile.b64.part1
#   .neverskip-profile.b64.part2
#
# Usage (after local headed login):
#   npm run neverskip:login
#   ./scripts/package-neverskip-profile.sh
#
# Then add GitHub Actions repository secrets (do not commit the files):
#   NEVERSKIP_PROFILE_B64_1  ← contents of .neverskip-profile.b64.part1
#   NEVERSKIP_PROFILE_B64_2  ← contents of .neverskip-profile.b64.part2
#
# GitHub Actions repository secrets are limited (~48 KB). The Base64 text is
# split into two parts so each secret stays comfortably under that limit.
# This script packs only authentication-relevant Chromium files.
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
OUT_PART1="$ROOT_DIR/.neverskip-profile.b64.part1"
OUT_PART2="$ROOT_DIR/.neverskip-profile.b64.part2"
OUT_TGZ="$ROOT_DIR/.neverskip-profile.tgz"
EXPORT_DIR="$ROOT_DIR/.neverskip-profile-export"
# Per-part limit (GitHub repository secrets max ~48 KB; keep headroom)
MAX_PART_BYTES=49152

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
# Write unwrapped base64 to file only — never echo the payload.
# Unwrapped form avoids mid-file newlines that GitHub secret UI may alter when pasting parts.
python3 - <<'PY'
from pathlib import Path
import base64
root = Path(".")
tgz = (root / ".neverskip-profile.tgz").read_bytes()
(root / ".neverskip-profile.b64").write_bytes(base64.b64encode(tgz))
PY

B64_SIZE="$(wc -c < "$OUT_B64" | tr -d ' ')"
TGZ_SIZE="$(wc -c < "$OUT_TGZ" | tr -d ' ')"

# Deterministic byte-safe split of Base64 text (not the decoded archive).
# part1 + part2 must equal .neverskip-profile.b64 exactly.
MID=$((B64_SIZE / 2))
dd if="$OUT_B64" of="$OUT_PART1" bs=1 count="$MID" status=none 2>/dev/null \
  || dd if="$OUT_B64" of="$OUT_PART1" bs=1 count="$MID" 2>/dev/null
dd if="$OUT_B64" of="$OUT_PART2" bs=1 skip="$MID" status=none 2>/dev/null \
  || dd if="$OUT_B64" of="$OUT_PART2" bs=1 skip="$MID" 2>/dev/null

PART1_SIZE="$(wc -c < "$OUT_PART1" | tr -d ' ')"
PART2_SIZE="$(wc -c < "$OUT_PART2" | tr -d ' ')"

echo "Packaged NeverSkip profile (minimal auth set)."
echo "  Source:     $PROFILE_SRC"
echo "  Files:      $FILE_COUNT"
echo "  Archive:    .neverskip-profile.tgz (${TGZ_SIZE} bytes)"
echo "Part 1 size: ${PART1_SIZE} bytes"
echo "Part 2 size: ${PART2_SIZE} bytes"
echo "Total Base64 size: ${B64_SIZE} bytes"

if [[ "$PART1_SIZE" -ge "$MAX_PART_BYTES" ]] || [[ "$PART2_SIZE" -ge "$MAX_PART_BYTES" ]]; then
  echo "ERROR: A Base64 part is too large for a GitHub Actions secret (>= ${MAX_PART_BYTES})." >&2
  echo "Re-login with a fresh profile or trim unused storage, then retry." >&2
  exit 1
fi

# Local reconstruction self-check (temp file only; never printed)
RECON_TMP="$(mktemp)"
cat "$OUT_PART1" "$OUT_PART2" > "$RECON_TMP"
if ! cmp -s "$OUT_B64" "$RECON_TMP"; then
  rm -f "$RECON_TMP"
  echo "ERROR: part1+part2 reconstruction does not match .neverskip-profile.b64" >&2
  exit 1
fi
rm -f "$RECON_TMP"

echo "OK: parts reconstruct to full Base64; each part under ${MAX_PART_BYTES} bytes."
echo "Next: add GitHub secrets NEVERSKIP_PROFILE_B64_1 and NEVERSKIP_PROFILE_B64_2"
echo "  NEVERSKIP_PROFILE_B64_1 ← .neverskip-profile.b64.part1"
echo "  NEVERSKIP_PROFILE_B64_2 ← .neverskip-profile.b64.part2"
echo "Do NOT commit .neverskip-profile.b64 / .part1 / .part2 / .tgz / .neverskip-profile-export/"

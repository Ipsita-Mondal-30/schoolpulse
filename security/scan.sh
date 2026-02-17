#!/bin/bash

# Configuration
TARGET_URL="https://www.schoolpuls.in"
REPORT_NAME="zap_report.html"

echo "Starting OWASP ZAP Baseline Scan for $TARGET_URL..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Pull the latest ZAP image
echo "Pulling latest OWASP ZAP image..."
docker pull ghcr.io/zaproxy/zaproxy:stable

# Run the scan
# -t: Target URL
# -r: Report file name
# -v: Mount current directory to /zap/wrk to save report
echo "Running scan..."
docker run --rm -v $(pwd):/zap/wrk/:rw -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
    -t "$TARGET_URL" \
    -r "$REPORT_NAME" \
    -I  # Ignore warnings and only file on errors

echo "Scan complete. Report saved to security/$REPORT_NAME"

# Shared worker settings for run-sync.sh, login.sh and auth-check.sh (source, do not execute).
# Login and sync MUST use the same browser profile, so it is resolved once, here.
# Never echoes secrets.

WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${WORKER_DIR}/../.." && pwd)"
ENV_FILE="${WORKER_DIR}/.env"
LOCK_FILE="${WORKER_DIR}/neverskip-data/sync.lock"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PROFILE_DIR="${NEVERSKIP_PROFILE_DIR:-${WORKER_DIR}/neverskip-data/neverskip-profile}"
if [[ "$PROFILE_DIR" != /* ]]; then
  PROFILE_DIR="${REPO_ROOT}/${PROFILE_DIR}"
fi
export NEVERSKIP_PROFILE_DIR="$PROFILE_DIR"

mkdir -p "$(dirname "$LOCK_FILE")"
cd "$REPO_ROOT"

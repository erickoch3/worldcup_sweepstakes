#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${APP_DIR}"

source_env_file() {
  if [[ ! -f ".env" ]]; then
    return 0
  fi

  local existing_exports=""
  existing_exports="$(mktemp)"
  export -p | sed 's/^declare -x /export /' > "${existing_exports}"

  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a

  # Explicit environment values supplied to the script override .env defaults.
  # shellcheck disable=SC1090
  source "${existing_exports}"
  rm -f "${existing_exports}"
}

source_env_file

export PRODUCTION_DATA_DIR="${PRODUCTION_DATA_DIR:-${HOME}/.local/share/worldcup-sweepstakes}"
mkdir -p "${PRODUCTION_DATA_DIR}/logs"

LOCK_FILE="${WORLD_CUP_SYNC_LOCK_FILE:-${PRODUCTION_DATA_DIR}/worldcup-sync.lock}"

if [[ "${WORLD_CUP_SYNC_LOCKED:-0}" != "1" ]]; then
  if command -v flock >/dev/null 2>&1; then
    exec flock -n "${LOCK_FILE}" env WORLD_CUP_SYNC_LOCKED=1 "${APP_DIR}/scripts/sync-worldcup-data.sh" "$@"
  fi

  LOCK_DIR="${LOCK_FILE}.dir"
  if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
    echo "World Cup sync already running; exiting."
    exit 0
  fi
  trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT
fi

"${APP_DIR}/start_production.sh" --sync-worldcup-data "$@"

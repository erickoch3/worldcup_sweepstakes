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
export DATABASE_URL="${DATABASE_URL:-file:${PRODUCTION_DATA_DIR}/worldcup.db}"
BLUE_GREEN_RELEASE_ROOT="${BLUE_GREEN_RELEASE_ROOT:-${APP_DIR}/.releases}"
BACKUP_LABEL="${1:-manual}"
BACKUP_KEEP_LAST="${BACKUP_KEEP_LAST:-672}"

safe_label="$(printf '%s' "${BACKUP_LABEL}" | tr -c 'A-Za-z0-9_.-' '-')"
DATABASE_URL="$(APP_DIR="${APP_DIR}" DATABASE_URL="${DATABASE_URL}" node "${APP_DIR}/scripts/production-db.mjs" resolve)"
export DATABASE_URL

APP_DIR="${APP_DIR}" \
  DATABASE_URL="${DATABASE_URL}" \
  BLUE_GREEN_RELEASE_ROOT="${BLUE_GREEN_RELEASE_ROOT}" \
  node "${APP_DIR}/scripts/production-db.mjs" assert-safe

db_path="$(APP_DIR="${APP_DIR}" DATABASE_URL="${DATABASE_URL}" node "${APP_DIR}/scripts/production-db.mjs" path)"
backup_dir="${PRODUCTION_DB_BACKUP_DIR:-${PRODUCTION_DATA_DIR}/backups}"

if [[ ! -f "${db_path}" ]]; then
  echo "No existing SQLite database at ${db_path}; backup skipped"
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for safe production database backups" >&2
  exit 1
fi

mkdir -p "${backup_dir}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${backup_dir}/worldcup-${safe_label}-${timestamp}.db"

sqlite3 -readonly "${db_path}" "PRAGMA quick_check;" | grep -qx "ok"
sqlite3 "${db_path}" ".backup '${backup_path}'"
sqlite3 -readonly "${backup_path}" "PRAGMA integrity_check;" | grep -qx "ok"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${backup_path}" > "${backup_path}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${backup_path}" > "${backup_path}.sha256"
fi

find "${backup_dir}" -maxdepth 1 -type f -name 'worldcup-*.db' -print 2>/dev/null \
  | sort -r \
  | tail -n +"$((BACKUP_KEEP_LAST + 1))" \
  | while IFS= read -r old_backup; do
      rm -f "${old_backup}" "${old_backup}.sha256"
    done

echo "Backed up SQLite database to ${backup_path}"

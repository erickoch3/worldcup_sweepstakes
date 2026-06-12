#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

if [[ "$#" -gt 1 && "${1:-}" != "--sync-worldcup-data" ]]; then
  echo "Usage: $0 [--prepare-only|--serve-only|--blue-green-deploy|--blue-green-proxy|--sync-worldcup-data] [--dry-run]" >&2
  exit 2
fi

MODE="run"
case "${1:-}" in
  "")
    ;;
  "--prepare-only")
    MODE="prepare"
    ;;
  "--serve-only")
    MODE="serve"
    ;;
  "--blue-green-deploy")
    MODE="blue-green-deploy"
    ;;
  "--blue-green-proxy")
    MODE="blue-green-proxy"
    ;;
  "--sync-worldcup-data")
    MODE="sync-worldcup-data"
    ;;
  *)
    echo "Usage: $0 [--prepare-only|--serve-only|--blue-green-deploy|--blue-green-proxy|--sync-worldcup-data] [--dry-run]" >&2
    exit 2
    ;;
esac

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

export NODE_ENV=production
export HOSTNAME="${APP_HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-42427}"
export PRODUCTION_DATA_DIR="${PRODUCTION_DATA_DIR:-${HOME}/.local/share/worldcup-sweepstakes}"
export DATABASE_URL="${DATABASE_URL:-file:${PRODUCTION_DATA_DIR}/worldcup.db}"

NODE_VERSION="26.2.0"
NODE_DIST="node-v${NODE_VERSION}-linux-x64"
NODE_ARCHIVE="${NODE_DIST}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
NODE_CACHE_ROOT="${NODE_CACHE_ROOT:-${HOME}/.local/worldcup-sweepstakes}"
NODE_HOME="${NODE_HOME:-${NODE_CACHE_ROOT}/${NODE_DIST}}"

node_is_valid() {
  local node_bin="$1"
  local node_version=""

  if [[ ! -x "${node_bin}" ]]; then
    return 1
  fi

  node_version="$(${node_bin} -v 2>/dev/null || true)"
  [[ "${node_version}" == v26.* ]]
}

npm_is_valid() {
  local npm_bin="$1"
  local npm_version=""

  if [[ ! -x "${npm_bin}" ]]; then
    return 1
  fi

  npm_version="$(${npm_bin} -v 2>/dev/null || true)"
  [[ "${npm_version}" == 11.* ]]
}

install_node_26() {
  mkdir -p "${NODE_CACHE_ROOT}"

  local temp_dir=""
  temp_dir="$(mktemp -d "${NODE_CACHE_ROOT}/node-install.XXXXXX")"

  echo "Installing Node.js ${NODE_VERSION} into ${NODE_HOME}"
  curl -fsSL "${NODE_URL}" -o "${temp_dir}/${NODE_ARCHIVE}"
  tar -xzf "${temp_dir}/${NODE_ARCHIVE}" -C "${temp_dir}"

  local extracted_dir="${temp_dir}/${NODE_DIST}"
  if ! node_is_valid "${extracted_dir}/bin/node" || ! npm_is_valid "${extracted_dir}/bin/npm"; then
    echo "Downloaded Node.js archive did not provide Node v26 and npm 11" >&2
    exit 1
  fi

  rm -rf "${NODE_HOME}"
  mv "${extracted_dir}" "${NODE_HOME}"
  rm -rf "${temp_dir}"
}

ensure_node_26() {
  local current_node_version=""
  local current_npm_version=""

  if command -v node >/dev/null 2>&1; then
    current_node_version="$(node -v)"
  fi

  if command -v npm >/dev/null 2>&1; then
    current_npm_version="$(npm -v)"
  fi

  if [[ "${current_node_version}" != v26.* || "${current_npm_version}" != 11.* ]]; then
    if ! node_is_valid "${NODE_HOME}/bin/node" || ! npm_is_valid "${NODE_HOME}/bin/npm"; then
      rm -rf "${NODE_HOME}"
      install_node_26
    fi

    export PATH="${NODE_HOME}/bin:${PATH}"
  fi
}

normalize_database_url() {
  DATABASE_URL="$(APP_DIR="${APP_DIR}" DATABASE_URL="${DATABASE_URL}" node "${APP_DIR}/scripts/production-db.mjs" resolve)"
  export DATABASE_URL

  APP_DIR="${APP_DIR}" \
    DATABASE_URL="${DATABASE_URL}" \
    BLUE_GREEN_RELEASE_ROOT="${BLUE_GREEN_RELEASE_ROOT:-${APP_DIR}/.releases}" \
    node "${APP_DIR}/scripts/production-db.mjs" assert-safe
}

ensure_node_26

case "$(node -v)" in
  v26.*) ;;
  *)
    echo "Expected Node.js v26 after bootstrap, found $(node -v)" >&2
    exit 1
    ;;
esac

case "$(npm -v)" in
  11.*) ;;
  *)
    echo "Expected npm 11 after bootstrap, found $(npm -v)" >&2
    exit 1
    ;;
esac

echo "Using node $(node -v)"
echo "Using npm $(npm -v)"

normalize_database_url

db_path="$(
  APP_DIR="${APP_DIR}" DATABASE_URL="${DATABASE_URL}" node "${APP_DIR}/scripts/production-db.mjs" path
)"
echo "Using SQLite database at ${db_path}"

backup_database() {
  local label="$1"

  "${APP_DIR}/scripts/backup-sqlite-db.sh" "${label}"
}

prepare_app() {
  backup_database "prepare"
  rm -rf node_modules
  npm ci --include=dev
  npm run db:deploy
  npm run db:generate
  npm run db:seed
  npm run build
  "${APP_DIR}/scripts/sync-standalone-assets.sh"
}

sync_worldcup_data() {
  local sync_args=("${@:2}")
  local arg=""
  local dry_run="0"

  for arg in "${sync_args[@]}"; do
    if [[ "${arg}" == "--dry-run" ]]; then
      dry_run="1"
    fi
  done

  if [[ "${dry_run}" != "1" ]]; then
    backup_database "worldcup-sync"
  fi
  npm run sync:worldcup -- "${sync_args[@]}"
}

serve_app() {
  local server_entrypoint=""
  server_entrypoint="$(standalone_server_path ".")" || true
  if [[ -z "${server_entrypoint}" ]]; then
    echo "Cannot find standalone server entrypoint at .next/standalone/server.js" >&2
    exit 1
  fi

  exec node "${server_entrypoint}"
}

PUBLIC_LISTEN_PORT="${PORT}"
BLUE_GREEN_BACKEND_PORT_A="${BLUE_GREEN_BACKEND_PORT_A:-42428}"
BLUE_GREEN_BACKEND_PORT_B="${BLUE_GREEN_BACKEND_PORT_B:-42429}"
BLUE_GREEN_STATE_DIR="${BLUE_GREEN_STATE_DIR:-${APP_DIR}/.blue-green}"
BLUE_GREEN_RELEASE_ROOT="${BLUE_GREEN_RELEASE_ROOT:-${APP_DIR}/.releases}"
BLUE_GREEN_PROXY_PID_FILE="${BLUE_GREEN_STATE_DIR}/proxy.pid"
BLUE_GREEN_ACTIVE_BACKEND_FILE="${BLUE_GREEN_STATE_DIR}/active-backend-port"
BLUE_GREEN_ACTIVE_RELEASE_FILE="${BLUE_GREEN_STATE_DIR}/active-release-dir"
BLUE_GREEN_ACTIVE_PID_PREFIX="${BLUE_GREEN_STATE_DIR}/backend"
BLUE_GREEN_LOG_DIR="${BLUE_GREEN_STATE_DIR}/logs"
SKIP_PREPARE="${SKIP_PREPARE:-0}"
BLUE_GREEN_RELEASE_DIR="${BLUE_GREEN_RELEASE_DIR:-}"
BLUE_GREEN_RELEASE_ID="${BLUE_GREEN_RELEASE_ID:-}"
BLUE_GREEN_KEEP_RELEASES="${BLUE_GREEN_KEEP_RELEASES:-5}"

ensure_blue_green_dirs() {
  mkdir -p "${BLUE_GREEN_STATE_DIR}" "${BLUE_GREEN_RELEASE_ROOT}" "${BLUE_GREEN_LOG_DIR}"
}

backend_pid_file() {
  local port="$1"
  echo "${BLUE_GREEN_ACTIVE_PID_PREFIX}-${port}.pid"
}

read_active_backend_port() {
  if [[ ! -f "${BLUE_GREEN_ACTIVE_BACKEND_FILE}" ]]; then
    echo ""
    return 0
  fi

  tr -dc '0-9' < "${BLUE_GREEN_ACTIVE_BACKEND_FILE}" || true
}

write_active_backend_port() {
  local port="$1"
  local tmp=""
  tmp="$(mktemp "${BLUE_GREEN_ACTIVE_BACKEND_FILE}.tmp.XXXXXX")"
  printf '%s\n' "${port}" > "${tmp}"
  mv "${tmp}" "${BLUE_GREEN_ACTIVE_BACKEND_FILE}"
}

is_port_open() {
  local port="$1"
  (echo >/dev/tcp/127.0.0.1/${port}) >/dev/null 2>&1
}

is_proxy_running() {
  if [[ ! -f "${BLUE_GREEN_PROXY_PID_FILE}" ]]; then
    return 1
  fi

  local pid=""
  pid="$(tr -dc '0-9' < "${BLUE_GREEN_PROXY_PID_FILE}")"

  [[ -n "${pid}" ]] || return 1
  kill -0 "${pid}" 2>/dev/null
}

wait_for_port() {
  local port="$1"
  local tries="${2:-20}"
  local i

  for ((i = 1; i <= tries; i += 1)); do
    if is_port_open "${port}"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_port_closed() {
  local port="$1"
  local tries="${2:-20}"
  local i

  for ((i = 1; i <= tries; i += 1)); do
    if ! is_port_open "${port}"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

listener_pids_for_port() {
  local port="$1"
  local lsof_pids=""

  if command -v lsof >/dev/null 2>&1; then
    lsof_pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${lsof_pids}" ]]; then
      printf '%s\n' "${lsof_pids}"
      return 0
    fi
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :${port}" 2>/dev/null \
      | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
      | sort -u
  fi
}

stop_listeners_on_port() {
  local port="$1"
  local pid
  local pids=()

  mapfile -t pids < <(listener_pids_for_port "${port}")
  for pid in "${pids[@]}"; do
    [[ -n "${pid}" ]] || continue
    kill "${pid}" 2>/dev/null || true
  done

  if wait_for_port_closed "${port}" 10; then
    return 0
  fi

  mapfile -t pids < <(listener_pids_for_port "${port}")
  for pid in "${pids[@]}"; do
    [[ -n "${pid}" ]] || continue
    kill -9 "${pid}" 2>/dev/null || true
  done

  wait_for_port_closed "${port}" 10 || true
}

stop_backend_by_port_file() {
  local pid_file="$1"
  local port="${2:-}"

  if [[ ! -f "${pid_file}" ]]; then
    if [[ -n "${port}" ]]; then
      stop_listeners_on_port "${port}"
    fi
    return 0
  fi

  local pid=""
  pid="$(tr -dc '0-9' < "${pid_file}")"

  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}"
    if [[ -n "${port}" ]]; then
      stop_listeners_on_port "${port}"
    fi
    return 0
  fi

  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f "${pid_file}"
    if [[ -n "${port}" ]]; then
      stop_listeners_on_port "${port}"
    fi
    return 0
  fi

  kill "${pid}" || true

  local i
  for ((i = 1; i <= 20; i += 1)); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${pid_file}"
      if [[ -n "${port}" ]]; then
        stop_listeners_on_port "${port}"
      fi
      return 0
    fi
    sleep 1
  done

  kill -9 "${pid}" || true
  rm -f "${pid_file}"
  if [[ -n "${port}" ]]; then
    stop_listeners_on_port "${port}"
  fi
}

copy_release_source() {
  local destination="$1"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='.releases' \
      --exclude='.blue-green' \
      --exclude='/data' \
      --exclude='coverage' \
      --exclude='playwright-report' \
      --exclude='test-results' \
      "${APP_DIR}/" "${destination}/"
    return 0
  fi

  tar -C "${APP_DIR}" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.releases' \
    --exclude='.blue-green' \
    --exclude='./data' \
    --exclude='coverage' \
    --exclude='playwright-report' \
    --exclude='test-results' \
    -cf - . | tar -C "${destination}" -xf -
}

prune_old_releases() {
  local active_release_dir="$1"
  local keep_count="${BLUE_GREEN_KEEP_RELEASES}"
  local releases=()
  local release_dir
  local kept_count=0

  if [[ ! "${keep_count}" =~ ^[0-9]+$ ]] || ((keep_count < 1)); then
    echo "BLUE_GREEN_KEEP_RELEASES must be a positive integer" >&2
    return 1
  fi

  mapfile -t releases < <(find "${BLUE_GREEN_RELEASE_ROOT}" -mindepth 1 -maxdepth 1 -type d -print | sort -r)

  for release_dir in "${releases[@]}"; do
    if ((kept_count < keep_count)); then
      kept_count=$((kept_count + 1))
      continue
    fi

    if [[ "${release_dir}" == "${active_release_dir}" ]]; then
      continue
    fi

    rm -rf "${release_dir}"
  done
}

prepare_release() {
  local release_dir="$1"
  local release_id="$2"

  echo "Preparing release ${release_id} in ${release_dir}"
  rm -rf "${release_dir}"
  mkdir -p "${release_dir}"

  copy_release_source "${release_dir}"
  backup_database "deploy-${release_id}"

  (
    cd "${release_dir}"
    npm ci --include=dev
    npm run db:deploy
    npm run db:generate
    npm run db:seed
    npm run build
    SYNC_TARGET_DIR="${release_dir}" "${APP_DIR}/scripts/sync-standalone-assets.sh"
  )
}

start_backend() {
  local release_dir="$1"
  local port="$2"
  local pid_file="$3"
  local log_file="$4"
  local server_entrypoint=""

  mkdir -p "${BLUE_GREEN_LOG_DIR}"

  server_entrypoint="$(standalone_server_path "${release_dir}")" || true
  if [[ -z "${server_entrypoint}" ]]; then
    echo "Candidate release does not contain standalone server.js: ${release_dir}" >&2
    return 1
  fi

  (
    cd "${release_dir}"
    exec env HOSTNAME="${HOSTNAME}" PORT="${port}" node "${server_entrypoint}"
  ) >> "${log_file}" 2>&1 &

  local pid="$!"
  echo "${pid}" > "${pid_file}"
  echo "${pid}"
}

http_status() {
  local port="$1"
  local path="$2"

  curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}${path}" || true
}

route_is_2xx_or_3xx() {
  local status="$1"
  [[ "${status}" == 2* || "${status}" == 3* ]]
}

route_is_3xx() {
  local status="$1"
  [[ "${status}" == 3* ]]
}

probe_candidate_backend() {
  local port="$1"
  local path status

  for path in / /schedule /bracket /login; do
    status="$(http_status "${port}" "${path}")"
    if [[ -z "${status}" ]] || ! route_is_2xx_or_3xx "${status}"; then
      echo "Candidate backend check failed for ${path}: ${status:-no response}" >&2
      return 1
    fi
  done

  status="$(http_status "${port}" "/api/auth/signin/google")"
  if [[ -z "${status}" ]] || ! route_is_3xx "${status}"; then
    echo "Auth redirect check failed: /api/auth/signin/google => ${status:-no response}" >&2
    return 1
  fi

  return 0
}

probe_public_backend() {
  local path status

  for path in / /schedule /bracket /login; do
    status="$(http_status "${PUBLIC_LISTEN_PORT}" "${path}")"
    if [[ -z "${status}" ]] || ! route_is_2xx_or_3xx "${status}"; then
      echo "Public listener check failed for ${path}: ${status:-no response}" >&2
      return 1
    fi
  done

  status="$(http_status "${PUBLIC_LISTEN_PORT}" "/api/auth/signin/google")"
  if [[ -z "${status}" ]] || ! route_is_3xx "${status}"; then
    echo "Public auth redirect check failed: /api/auth/signin/google => ${status:-no response}" >&2
    return 1
  fi

  return 0
}

wait_for_candidate() {
  local port="$1"
  local tries="${2:-45}"
  local i

  for ((i = 1; i <= tries; i += 1)); do
    if probe_candidate_backend "${port}"; then
      echo "Candidate backend on ${port} is healthy"
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_public() {
  local tries="${1:-30}"
  local i

  for ((i = 1; i <= tries; i += 1)); do
    if probe_public_backend; then
      return 0
    fi
    sleep 1
  done

  return 1
}

start_proxy_in_background() {
  local target_port="$1"

  ensure_blue_green_dirs
  if is_proxy_running; then
    return 0
  fi

  if is_port_open "${PUBLIC_LISTEN_PORT}"; then
    echo "Public listener ${PUBLIC_LISTEN_PORT} is already in use and proxy is not managed by this script" >&2
    return 1
  fi

  write_active_backend_port "${target_port}"
  printf '%s\n' "$$" > "${BLUE_GREEN_PROXY_PID_FILE}"

  BLUE_GREEN_BACKEND_PORT_FILE="${BLUE_GREEN_ACTIVE_BACKEND_FILE}" \
    BLUE_GREEN_LISTEN_PORT="${PUBLIC_LISTEN_PORT}" \
    BLUE_GREEN_LISTEN_HOST="${HOSTNAME}" \
    BLUE_GREEN_FALLBACK_BACKEND_PORT="${target_port}" \
    node "${APP_DIR}/scripts/blue-green-proxy.js" >> "${BLUE_GREEN_LOG_DIR}/proxy.log" 2>&1 &

  echo "$!" > "${BLUE_GREEN_PROXY_PID_FILE}"
  if ! wait_for_port "${PUBLIC_LISTEN_PORT}" 20; then
    return 1
  fi
}

stop_proxy() {
  if ! is_proxy_running; then
    return 0
  fi

  local pid=""
  pid="$(tr -dc '0-9' < "${BLUE_GREEN_PROXY_PID_FILE}")"
  kill "${pid}" || true

  local i
  for ((i = 1; i <= 20; i += 1)); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${BLUE_GREEN_PROXY_PID_FILE}"
      wait_for_port_closed "${PUBLIC_LISTEN_PORT}" 20 || true
      return 0
    fi
    sleep 1
  done

  kill -9 "${pid}" || true
  rm -f "${BLUE_GREEN_PROXY_PID_FILE}"
  wait_for_port_closed "${PUBLIC_LISTEN_PORT}" 20 || true
}

blue_green_proxy() {
  ensure_blue_green_dirs

  if is_proxy_running; then
    echo "Blue-green proxy already running"
    return 0
  fi

  if is_port_open "${PUBLIC_LISTEN_PORT}"; then
    echo "Cannot start proxy: port ${PUBLIC_LISTEN_PORT} already has a listener" >&2
    return 1
  fi

  local target_port=""
  target_port="$(read_active_backend_port)"
  if [[ -z "${target_port}" ]]; then
    target_port="${BLUE_GREEN_BACKEND_PORT_A}"
  fi

  write_active_backend_port "${target_port}"

  BLUE_GREEN_BACKEND_PORT_FILE="${BLUE_GREEN_ACTIVE_BACKEND_FILE}" \
    BLUE_GREEN_LISTEN_PORT="${PUBLIC_LISTEN_PORT}" \
    BLUE_GREEN_LISTEN_HOST="${HOSTNAME}" \
    BLUE_GREEN_FALLBACK_BACKEND_PORT="${target_port}" \
    exec node "${APP_DIR}/scripts/blue-green-proxy.js"
}

blue_green_deploy() {
  ensure_blue_green_dirs

  local release_id="${BLUE_GREEN_RELEASE_ID}"
  if [[ -z "${release_id}" ]]; then
    release_id="$(date -u +%Y%m%dT%H%M%SZ)"
  fi

  local release_dir="${BLUE_GREEN_RELEASE_ROOT}/${release_id}"
  local previous_port=""
  local candidate_port=""
  local previous_pid_file=""
  local candidate_pid_file=""
  local candidate_pid=""
  local started_proxy="0"

  previous_port="$(read_active_backend_port)"

  if [[ "${previous_port}" == "${BLUE_GREEN_BACKEND_PORT_A}" ]]; then
    candidate_port="${BLUE_GREEN_BACKEND_PORT_B}"
  else
    candidate_port="${BLUE_GREEN_BACKEND_PORT_A}"
  fi

  if [[ "${SKIP_PREPARE}" == "1" ]]; then
    if [[ -z "${BLUE_GREEN_RELEASE_DIR}" ]]; then
      echo "SKIP_PREPARE=1 requires BLUE_GREEN_RELEASE_DIR" >&2
      exit 2
    fi
    release_dir="${BLUE_GREEN_RELEASE_DIR}"
    if ! standalone_server_path "${release_dir}" >/dev/null; then
      echo "Release directory does not contain a built standalone server: ${release_dir}" >&2
      exit 2
    fi
  else
    prepare_release "${release_dir}" "${release_id}"
  fi

  echo "Candidate release: ${release_dir}"

  candidate_pid_file="$(backend_pid_file "${candidate_port}")"
  previous_pid_file="$(backend_pid_file "${previous_port}")"

  stop_backend_by_port_file "${candidate_pid_file}" "${candidate_port}"
  if is_port_open "${candidate_port}"; then
    echo "Candidate port ${candidate_port} is occupied" >&2
    exit 1
  fi

  candidate_pid="$(start_backend "${release_dir}" "${candidate_port}" "${candidate_pid_file}" "${BLUE_GREEN_LOG_DIR}/backend-${candidate_port}.log")"

  if ! wait_for_candidate "${candidate_port}"; then
    stop_backend_by_port_file "${candidate_pid_file}" "${candidate_port}"
    echo "Candidate warmup failed" >&2
    exit 1
  fi

  if ! is_proxy_running; then
    if is_port_open "${PUBLIC_LISTEN_PORT}"; then
      echo "Proxy is not running and ${PUBLIC_LISTEN_PORT} is in use."
      echo "First cutover from direct Next.js-on-${PUBLIC_LISTEN_PORT} to proxy-on-${PUBLIC_LISTEN_PORT} requires a brief restart window."
      stop_backend_by_port_file "${candidate_pid_file}" "${candidate_port}"
      exit 1
    fi

    if ! start_proxy_in_background "${candidate_port}"; then
      stop_backend_by_port_file "${candidate_pid_file}" "${candidate_port}"
      echo "Failed to start proxy on ${PUBLIC_LISTEN_PORT}" >&2
      exit 1
    fi
    started_proxy="1"
  else
    write_active_backend_port "${candidate_port}"
  fi

  if ! wait_for_public; then
    echo "Public listener ${PUBLIC_LISTEN_PORT} did not return healthy responses after swap" >&2
    if [[ -n "${previous_port}" ]]; then
      write_active_backend_port "${previous_port}"
    else
      rm -f "${BLUE_GREEN_ACTIVE_BACKEND_FILE}"
    fi
    if [[ "${started_proxy}" == "1" ]]; then
      stop_proxy
    fi
    stop_backend_by_port_file "${candidate_pid_file}" "${candidate_port}"
    exit 1
  fi

  write_active_backend_port "${candidate_port}"

  if [[ -n "${previous_port}" && "${previous_port}" != "${candidate_port}" ]]; then
    stop_backend_by_port_file "${previous_pid_file}" "${previous_port}"
  fi

  echo "${release_dir}" > "${BLUE_GREEN_ACTIVE_RELEASE_FILE}"
  ln -sfn "${release_dir}" "${BLUE_GREEN_STATE_DIR}/current-release"
  prune_old_releases "${release_dir}"

  echo "Blue-green deployment complete"
  echo "Active backend port: ${candidate_port}"
  echo "Active release: ${release_dir}"
}

standalone_server_path() {
  local root_dir="$1"
  local primary_path=""
  local nested_path=""

  primary_path="${root_dir}/.next/standalone/server.js"
  if [[ -f "${primary_path}" ]]; then
    echo "${primary_path}"
    return 0
  fi

  nested_path="$(find "${root_dir}/.next/standalone" -type f -name server.js -print | head -n 1)"
  if [[ -n "${nested_path}" ]]; then
    echo "${nested_path}"
    return 0
  fi

  return 1
}

case "${MODE}" in
  "prepare")
    prepare_app
    ;;
  "serve")
    serve_app
    ;;
  "blue-green-deploy")
    blue_green_deploy
    ;;
  "blue-green-proxy")
    blue_green_proxy
    ;;
  "sync-worldcup-data")
    sync_worldcup_data "$@"
    ;;
  "run")
    prepare_app
    serve_app
    ;;
  *)
    echo "Usage: $0 [--prepare-only|--serve-only|--blue-green-deploy|--blue-green-proxy|--sync-worldcup-data] [--dry-run]" >&2
    exit 2
    ;;
esac

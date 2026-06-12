#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SESSION_NAME="${SESSION_NAME:-worldcup-sweepstakes}"

cleanup_stale_tmux_socket() {
  if tmux list-sessions >/dev/null 2>&1; then
    return
  fi

  local socket_dir="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"

  rm -f "${socket_dir}/default"
  rmdir "${socket_dir}" 2>/dev/null || true
}

cleanup_stale_tmux_socket

if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
  echo "Reusing existing ${SESSION_NAME} and applying blue-green cutover"
else
  echo "Starting ${SESSION_NAME} from ${APP_DIR} with blue-green proxy"
  if ! tmux new-session -d -s "${SESSION_NAME}" -c "${APP_DIR}" "./start_production.sh --blue-green-proxy"; then
    cleanup_stale_tmux_socket
    tmux new-session -d -s "${SESSION_NAME}" -c "${APP_DIR}" "./start_production.sh --blue-green-proxy"
  fi
fi

echo "Deploying release through blue-green controller"
"${APP_DIR}/start_production.sh" --blue-green-deploy

echo "Active sessions:"
tmux list-sessions
echo
echo "Follow logs with:"
echo "  tmux attach -t ${SESSION_NAME}"
echo "  tmux capture-pane -pt ${SESSION_NAME} -S -80"

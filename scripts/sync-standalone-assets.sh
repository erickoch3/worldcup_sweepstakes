#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SYNC_TARGET_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -d ".next/standalone" ]]; then
  echo "Expected .next/standalone after build, but it does not exist" >&2
  exit 1
fi

if [[ ! -d ".next/static" ]]; then
  echo "Expected .next/static after build, but it does not exist" >&2
  exit 1
fi

if [[ ! -d ".next/server" ]]; then
  echo "Expected .next/server after build, but it does not exist" >&2
  exit 1
fi

standalone_server_path="$(find ".next/standalone" -maxdepth 3 -type f -name server.js -print | head -n 1 || true)"
if [[ -z "${standalone_server_path}" ]]; then
  echo "Expected .next/standalone/server.js after build, but it does not exist" >&2
  exit 1
fi

if [[ "${standalone_server_path}" != ".next/standalone/server.js" ]]; then
  mkdir -p ".next/standalone"
  cp "${standalone_server_path}" ".next/standalone/server.js"
fi

rm -rf ".next/standalone/.next"
mkdir -p ".next/standalone/.next"

for item in .next/*; do
  item_name="$(basename "${item}")"
  if [[ "${item_name}" == "standalone" ]]; then
    continue
  fi
  cp -R "${item}" ".next/standalone/.next/"
done

rm -rf ".next/standalone/public"
if [[ -d "public" ]]; then
  cp -R "public" ".next/standalone/public"
fi

echo "Synced Next standalone server and static assets"
